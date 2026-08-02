import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

/**
 * Scroll-driven WebGL backdrop for the landing page. It stages the product in
 * five beats across the whole page, so scrolling *is* the product demo:
 *
 *   0.00–0.20  scattered  — reports tumbling loose in the dark, unsorted
 *   0.20–0.44  projects   — they sort themselves into five lit columns
 *   0.44–0.64  converge   — the columns stream inward and stack into one inbox
 *   0.62–0.80  triage     — one card lifts out, a status ring closes on it
 *   0.80–1.00  resolved   — the ring completes and the board settles, cleared
 *
 * Deliberately restrained: plum ground, gold and violet accents only, gentle
 * bloom. Purely decorative — the page's real content is HTML on top of it, and
 * the canvas is aria-hidden.
 *
 * Written against three.js directly rather than react-three-fiber. The scene
 * mutates instance matrices for ninety objects every frame and never
 * re-renders, so a reconciler would be pure overhead, and the postprocessing
 * chain stays explicit.
 */

const CARD_W = 2.1;
const CARD_H = 0.56;
const CARD_D = 0.07;

const CARDS = 90;
const COLUMNS = 5; // one per project
const DUST = 240;

const PLUM = 0x17101f;
const PANEL = 0x4a3d63;
const GOLD = 0xf7b83d;
const VIOLET = 0xb58bf9;

/** Category accents, matching the dashboard's own chips. */
const ACCENTS = [0xf7b83d, 0xb58bf9, 0xe8833a, 0x6ba8e5, 0x5ec8a0];

/** The card that gets picked out and triaged in act four. */
const HERO_INDEX = 12;

/**
 * Keyframed camera path, sampled by scroll progress.
 *
 * A path rather than a formula: the shots are art-directed, and interpolating
 * between chosen positions is far easier to tune than compounding sines.
 */
const CAM: { pos: [number, number, number]; tgt: [number, number, number] }[] = [
  { pos: [1.6, 2.4, 27], tgt: [0, 0, 0] }, // wide, the loose backlog
  { pos: [-3.8, 1.5, 18.5], tgt: [0, 0.2, 0] }, // drift across the sorted columns
  { pos: [0.4, 0.6, 11], tgt: [0, 0.1, 0] }, // follow them inward
  { pos: [0, 0.1, 7.4], tgt: [0, 0.1, 0] }, // push in on the triaged card
  { pos: [0.9, 3.4, 20], tgt: [0, -0.5, 0] }, // pull back over the cleared board
];

const clamp01 = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : t);
const smooth = (t: number) => t * t * (3 - 2 * t);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Eased 0→1 ramp across the scroll window [a, b]. The scene is written in these. */
const phase = (p: number, a: number, b: number) => smooth(clamp01((p - a) / (b - a)));

/** Deterministic PRNG so the composition is identical on every load. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function sampleCam(p: number) {
  const span = CAM.length - 1;
  const i = Math.min(span - 1, Math.floor(p * span));
  const local = smooth(clamp01(p * span - i));
  const a = CAM[i]!;
  const b = CAM[i + 1]!;

  return {
    pos: [0, 1, 2].map((k) => lerp(a.pos[k]!, b.pos[k]!, local)) as [number, number, number],
    tgt: [0, 1, 2].map((k) => lerp(a.tgt[k]!, b.tgt[k]!, local)) as [number, number, number],
  };
}

/** A rounded-rectangle card with a soft bevel, so edges catch the key light. */
function cardGeometry(): THREE.ExtrudeGeometry {
  const r = 0.12;
  const w = CARD_W / 2 - r;
  const h = CARD_H / 2 - r;

  const shape = new THREE.Shape();
  shape.moveTo(-w - r, -h);
  shape.lineTo(-w - r, h);
  shape.quadraticCurveTo(-w - r, h + r, -w, h + r);
  shape.lineTo(w, h + r);
  shape.quadraticCurveTo(w + r, h + r, w + r, h);
  shape.lineTo(w + r, -h);
  shape.quadraticCurveTo(w + r, -h - r, w, -h - r);
  shape.lineTo(-w, -h - r);
  shape.quadraticCurveTo(-w - r, -h - r, -w - r, -h);

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: CARD_D,
    bevelEnabled: true,
    bevelThickness: 0.012,
    bevelSize: 0.014,
    bevelSegments: 2,
    curveSegments: 6,
  });
  geo.center();
  return geo;
}

/** Soft radial sprite for the dust motes. */
function moteTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;

  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.3, 'rgba(255,255,255,0.5)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);

  return new THREE.CanvasTexture(c);
}

export interface SceneHandle {
  dispose: () => void;
  setActive: (active: boolean) => void;
}

export interface SceneOptions {
  animate: boolean;
  quality: 'high' | 'low';
}

/**
 * Builds the scene into `mount` and drives it from `progressRef`.
 *
 * Returns a handle, or `null` when WebGL is unavailable. Kept as a plain
 * function rather than a component so the React layer stays a thin wrapper
 * with no per-frame involvement.
 */
export function createScene(
  mount: HTMLElement,
  progressRef: { current: number },
  pointerRef: { current: { x: number; y: number } },
  { animate, quality }: SceneOptions,
): SceneHandle | null {
  let renderer: THREE.WebGLRenderer;

  try {
    renderer = new THREE.WebGLRenderer({
      antialias: quality === 'high',
      powerPreference: 'high-performance',
    });
  } catch {
    // No WebGL, or it is blocked. The CSS ground behind us stands in.
    return null;
  }

  const width = () => mount.clientWidth || window.innerWidth;
  const height = () => mount.clientHeight || window.innerHeight;

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, quality === 'high' ? 2 : 1.5));
  renderer.setSize(width(), height());
  // Filmic tone mapping is most of what separates "some 3D shapes" from "a shot".
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  mount.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PLUM);
  scene.fog = new THREE.FogExp2(PLUM, 0.024);

  const camera = new THREE.PerspectiveCamera(48, width() / height(), 0.1, 400);
  camera.position.set(...CAM[0]!.pos);

  /* ------------------------------ lighting ------------------------------ */
  // Warm key, violet rim, gold counter-rim, cool fill. The rims are what make
  // the bevels read as edges rather than outlines.
  scene.add(new THREE.AmbientLight(0xffffff, 0.62));

  const key = new THREE.DirectionalLight(0xfff2e0, 2.3);
  key.position.set(-6, 9, 11);
  scene.add(key);

  const rim = new THREE.PointLight(VIOLET, 46, 42, 2);
  rim.position.set(3.6, -1.6, -7);
  scene.add(rim);

  const goldRim = new THREE.PointLight(GOLD, 26, 34, 2);
  goldRim.position.set(-5, 2.4, -6);
  scene.add(goldRim);

  const fill = new THREE.DirectionalLight(0x93a8c9, 0.5);
  fill.position.set(7, -4, 5);
  scene.add(fill);

  /* ------------------------------- cards -------------------------------- */
  const cardGeo = cardGeometry();
  const cardMat = new THREE.MeshStandardMaterial({
    color: PANEL,
    roughness: 0.52,
    metalness: 0.12,
  });

  const cards = new THREE.InstancedMesh(cardGeo, cardMat, CARDS);
  cards.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  cards.frustumCulled = false;
  scene.add(cards);

  // Category edge: a thin emissive bar riding the card's left edge. Emissive
  // and untonemapped, so bloom picks it up without any effect being animated.
  const accentGeo = new THREE.BoxGeometry(0.075, CARD_H * 0.64, CARD_D * 0.9);
  const accentMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xffffff,
    emissiveIntensity: 1.2,
    roughness: 0.4,
    toneMapped: false,
  });

  const accents = new THREE.InstancedMesh(accentGeo, accentMat, CARDS);
  accents.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  accents.frustumCulled = false;
  scene.add(accents);

  /* --------------------------- per-card layouts -------------------------- */
  const rand = rng(20260802);
  const accentColor = new THREE.Color();

  interface Seed {
    scatter: THREE.Vector3;
    spin: THREE.Euler;
    column: THREE.Vector3;
    stacked: THREE.Vector3;
    settled: THREE.Vector3;
    bob: number;
  }

  const seeds: Seed[] = [];

  for (let i = 0; i < CARDS; i += 1) {
    const col = i % COLUMNS;
    const row = Math.floor(i / COLUMNS);

    seeds.push({
      // Loose in the dark, tumbling.
      scatter: new THREE.Vector3((rand() - 0.5) * 32, (rand() - 0.5) * 18, -4 - rand() * 28),
      spin: new THREE.Euler((rand() - 0.5) * 2.6, (rand() - 0.5) * 3.4, (rand() - 0.5) * 2.2),
      // Sorted into five project columns.
      column: new THREE.Vector3((col - (COLUMNS - 1) / 2) * 2.62, 6.4 - row * 0.74, 0),
      // Streamed inward and stacked into one inbox.
      stacked: new THREE.Vector3((rand() - 0.5) * 0.12, 4.6 - i * 0.105, (rand() - 0.5) * 0.1),
      // Settled onto a cleared board.
      settled: new THREE.Vector3((col - (COLUMNS - 1) / 2) * 2.5, 3.4 - row * 0.62, -0.4),
      bob: rand() * Math.PI * 2,
    });

    accentColor.setHex(ACCENTS[i % ACCENTS.length]!);
    accents.setColorAt(i, accentColor);
  }

  if (accents.instanceColor) accents.instanceColor.needsUpdate = true;

  /* --------------------------- the status ring --------------------------- */
  // Closes around the triaged card, then completes as it resolves.
  const ringGeo = new THREE.TorusGeometry(0.62, 0.013, 10, 96);

  const openMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: new THREE.Color(GOLD),
    emissiveIntensity: 2.2,
    roughness: 0.35,
    toneMapped: false,
    transparent: true,
    opacity: 0,
  });
  const openRing = new THREE.Mesh(ringGeo, openMat);
  scene.add(openRing);

  const doneMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: new THREE.Color(VIOLET),
    emissiveIntensity: 2.6,
    roughness: 0.35,
    toneMapped: false,
    transparent: true,
    opacity: 0,
  });
  const doneRing = new THREE.Mesh(ringGeo, doneMat);
  scene.add(doneRing);

  /* -------------------------------- dust --------------------------------- */
  const dustGeo = new THREE.BufferGeometry();
  const dustPos = new Float32Array(DUST * 3);
  for (let i = 0; i < DUST; i += 1) {
    dustPos[i * 3] = (rand() - 0.5) * 60;
    dustPos[i * 3 + 1] = (rand() - 0.5) * 34;
    dustPos[i * 3 + 2] = -30 + rand() * 40;
  }
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));

  const moteMap = moteTexture();
  const dustMat = new THREE.PointsMaterial({
    size: 0.16,
    map: moteMap,
    color: VIOLET,
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
  });
  const dust = new THREE.Points(dustGeo, dustMat);
  scene.add(dust);

  /* ----------------------------- postprocessing -------------------------- */
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));

  let bloom: UnrealBloomPass | null = null;
  if (quality === 'high') {
    bloom = new UnrealBloomPass(new THREE.Vector2(width(), height()), 0.62, 0.85, 0.28);
    composer.addPass(bloom);
  }

  composer.addPass(new OutputPass());
  composer.setSize(width(), height());

  /* -------------------------------- loop --------------------------------- */
  const dummy = new THREE.Object3D();
  const target = new THREE.Vector3();
  const clock = new THREE.Clock();

  let raf = 0;
  let active = true;
  let disposed = false;

  const render = () => {
    raf = requestAnimationFrame(render);

    const delta = Math.min(clock.getDelta(), 0.1);
    if (!active) return;

    const p = clamp01(progressRef.current);
    const t = animate ? clock.getElapsedTime() : 4;

    // Beats.
    const sort = phase(p, 0.06, 0.42);
    const converge = phase(p, 0.44, 0.64);
    const triage = phase(p, 0.62, 0.8);
    const resolve = phase(p, 0.8, 0.96);

    for (let i = 0; i < CARDS; i += 1) {
      const s = seeds[i]!;
      const isHero = i === HERO_INDEX;

      dummy.position.copy(s.scatter).lerp(s.column, sort);
      dummy.position.lerp(s.stacked, converge);
      dummy.position.lerp(s.settled, resolve);

      // The triaged card lifts out of the stack and toward the camera.
      if (isHero) {
        dummy.position.x = lerp(dummy.position.x, 0, triage);
        dummy.position.y = lerp(dummy.position.y, 0.1, triage);
        dummy.position.z = lerp(dummy.position.z, 1.6, triage);
      }

      // A slow bob while loose, damped out as things settle.
      const loose = (1 - sort) * 0.6 + (1 - converge) * 0.4;
      if (animate) dummy.position.y += Math.sin(t * 0.7 + s.bob) * 0.09 * loose;

      dummy.rotation.set(lerp(s.spin.x, 0, sort), lerp(s.spin.y, 0, sort), lerp(s.spin.z, 0, sort));
      if (animate) dummy.rotation.z += Math.sin(t * 0.5 + s.bob) * 0.02 * loose;

      dummy.scale.setScalar(isHero ? 1 + triage * 0.24 : 1 - converge * 0.06);

      dummy.updateMatrix();
      cards.setMatrixAt(i, dummy.matrix);

      // The accent bar rides the card's left edge, in the card's local space.
      dummy.translateX(-CARD_W / 2 + 0.09);
      dummy.translateZ(CARD_D * 0.55);
      dummy.updateMatrix();
      accents.setMatrixAt(i, dummy.matrix);
    }

    cards.instanceMatrix.needsUpdate = true;
    accents.instanceMatrix.needsUpdate = true;

    openRing.position.set(0, 0.1, 1.6);
    openRing.rotation.z = t * 0.4;
    openRing.scale.setScalar(1.4 - triage * 0.45);
    openMat.opacity = triage * (1 - resolve) * 0.6;

    doneRing.position.copy(openRing.position);
    doneRing.rotation.z = -t * 0.3;
    doneRing.scale.setScalar(0.95 + resolve * 0.45);
    doneMat.opacity = resolve * (1 - phase(p, 0.94, 1)) * 0.7;

    if (animate) {
      dust.rotation.z = t * 0.01;
      // The rims breathe, which keeps the bevels alive between beats.
      rim.intensity = 46 + Math.sin(t * 0.8) * 8;
      goldRim.intensity = 26 + Math.cos(t * 0.6) * 6;
    }

    // Camera: sample the keyframed path, then damp toward it. Damping is
    // frame-rate independent so the shot reads the same at 60 and 120 Hz.
    const shot = sampleCam(p);
    const px = animate ? pointerRef.current.x * 0.9 : 0;
    const py = animate ? pointerRef.current.y * 0.5 : 0;

    const k = 1 - Math.pow(0.0018, delta);
    camera.position.x += (shot.pos[0] + px - camera.position.x) * k;
    camera.position.y += (shot.pos[1] + py - camera.position.y) * k;
    camera.position.z += (shot.pos[2] - camera.position.z) * k;

    target.set(shot.tgt[0], shot.tgt[1], shot.tgt[2]);
    camera.lookAt(target);

    composer.render();
  };

  const onResize = () => {
    const w = width();
    const h = height();

    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    composer.setSize(w, h);
    bloom?.setSize(w, h);
  };

  window.addEventListener('resize', onResize, { passive: true });
  raf = requestAnimationFrame(render);

  return {
    setActive(next: boolean) {
      active = next;
    },

    dispose() {
      if (disposed) return;
      disposed = true;

      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);

      cardGeo.dispose();
      cardMat.dispose();
      accentGeo.dispose();
      accentMat.dispose();
      ringGeo.dispose();
      openMat.dispose();
      doneMat.dispose();
      dustGeo.dispose();
      dustMat.dispose();
      moteMap.dispose();

      composer.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
