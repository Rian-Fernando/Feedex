import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

/**
 * "The Signal Field" — the Feedex landing backdrop.
 *
 * Feedex's story is not objects being sorted; it is *signal* — scattered sites
 * quietly emitting, and one place where all of it arrives. So the scene is
 * built from light rather than from things: seven screens suspended in the
 * dark, each trailing a ribbon of light toward a single aperture, which opens,
 * takes the flow, and resolves it into one legible column.
 *
 * Five beats, across the whole page:
 *
 *   0.00–0.18  dark      — one screen alone, the rest unlit in the depth
 *   0.18–0.40  field     — the others wake; the field of projects reveals
 *   0.40–0.60  signal    — ribbons ignite and begin flowing inward
 *   0.60–0.80  aperture  — the iris opens and takes the whole flow
 *   0.80–1.00  inbox     — the flow resolves into a single stacked column
 *
 * Purely decorative — the page's real content is HTML on top, and the canvas is
 * aria-hidden.
 *
 * Written against three.js directly. The scene animates by mutating transforms
 * and texture offsets every frame and never re-renders, so a reconciler would
 * be pure overhead, and the postprocessing chain stays explicit.
 */

const SCREENS = 7;
const ENTRIES = 16;
const BLADES = 6;
const DUST = 220;

const PLUM = 0x17101f;
const GOLD = 0xf7b83d;
const VIOLET = 0xb58bf9;

/** Category accents, matching the dashboard's own chips. */
const ACCENTS = [0xf7b83d, 0xb58bf9, 0xe8833a, 0x6ba8e5, 0x5ec8a0];

/** Where the flow arrives. Everything is composed around this point. */
const HUB = new THREE.Vector3(0, 0, 0);

/**
 * Keyframed camera path.
 *
 * Shot list rather than a formula: open tight on a single screen, pull back to
 * reveal the field, travel with the signal, pass through the aperture, and
 * settle square on the inbox.
 */
const CAM: { pos: [number, number, number]; tgt: [number, number, number] }[] = [
  { pos: [-5.2, 0.7, 7.4], tgt: [-6.4, 0.5, -1.6] }, // tight on one screen
  { pos: [-1.6, 2.6, 14.5], tgt: [0, 0.4, 0] }, // pull back, reveal the field
  { pos: [3.8, 1.2, 10.5], tgt: [0, 0.2, 0] }, // travel with the signal
  { pos: [0, 0.4, 5.6], tgt: [0, 0.1, 0] }, // through the aperture
  { pos: [0, 0.5, 9.6], tgt: [0, 0.25, 0] }, // settle square on the inbox
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

/**
 * The screen face: a dim interface with one lit accent and a widget button.
 *
 * Deliberately abstract — legible as "a site" at a glance and at any distance,
 * without pretending to be a real page.
 */
function screenTexture(accent: number): THREE.CanvasTexture {
  const w = 256;
  const h = 160;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;

  const ctx = canvas.getContext('2d')!;
  const hex = `#${accent.toString(16).padStart(6, '0')}`;

  ctx.fillStyle = '#3A2C52';
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fillRect(0, 0, w, 22);

  ctx.fillStyle = hex;
  ctx.globalAlpha = 0.75;
  ctx.fillRect(14, 8, 42, 7);
  ctx.globalAlpha = 1;

  const widths = [0.72, 0.5, 0.62, 0.36];
  for (let i = 0; i < widths.length; i += 1) {
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fillRect(16, 40 + i * 18, (w - 32) * widths[i]!, 6);
  }

  // The widget, in the corner where it actually sits.
  ctx.fillStyle = hex;
  ctx.beginPath();
  ctx.roundRect(w - 74, h - 30, 58, 18, 9);
  ctx.fill();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

/**
 * The travelling light along a ribbon.
 *
 * A repeating gradient scrolled along the tube's length. Far cheaper than
 * per-particle geometry, and it reads as continuous flow rather than beads.
 */
function flowTexture(): THREE.CanvasTexture {
  const w = 256;
  const h = 8;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;

  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, w, h);

  // Three comets per repeat, each with a long tail.
  for (let i = 0; i < 3; i += 1) {
    const head = (i / 3) * w;
    const grd = ctx.createLinearGradient(head - 70, 0, head, 0);
    grd.addColorStop(0, 'rgba(255,255,255,0)');
    grd.addColorStop(0.75, 'rgba(255,255,255,0.35)');
    grd.addColorStop(1, 'rgba(255,255,255,1)');
    ctx.fillStyle = grd;
    ctx.fillRect(head - 70, 0, 70, h);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

/** Soft radial sprite for the dust motes. */
function moteTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;

  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.35, 'rgba(255,255,255,0.4)');
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
    // No WebGL, or it is blocked. The page's own ground stands in.
    return null;
  }

  const width = () => mount.clientWidth || window.innerWidth;
  const height = () => mount.clientHeight || window.innerHeight;

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, quality === 'high' ? 2 : 1.5));
  renderer.setSize(width(), height());
  // Filmic tone mapping is most of what separates "some 3D shapes" from a shot.
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.22;
  mount.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PLUM);
  scene.fog = new THREE.FogExp2(PLUM, 0.016);

  const camera = new THREE.PerspectiveCamera(46, width() / height(), 0.1, 300);
  camera.position.set(...CAM[0]!.pos);

  /* ------------------------------ lighting ------------------------------ */
  // Low ambient so the emissive elements carry the frame, a warm key to pick
  // out the screen bezels, and two coloured rims for edge separation.
  scene.add(new THREE.AmbientLight(0xffffff, 0.5));

  const key = new THREE.DirectionalLight(0xfff2e0, 2.1);
  key.position.set(-7, 6, 12);
  scene.add(key);

  const violetRim = new THREE.PointLight(VIOLET, 40, 40, 2);
  violetRim.position.set(2.8, -1.4, -5);
  scene.add(violetRim);

  const goldRim = new THREE.PointLight(GOLD, 22, 30, 2);
  goldRim.position.set(-5.5, 2.6, -4);
  scene.add(goldRim);

  // Sits at the hub and rises with the story — the inbox lighting the room.
  const hubLight = new THREE.PointLight(VIOLET, 0, 26, 2);
  hubLight.position.copy(HUB);
  scene.add(hubLight);

  const rand = rng(20260802);

  /* ------------------------------- screens ------------------------------ */
  const screenGeo = new THREE.PlaneGeometry(2.2, 1.375);
  const bezelGeo = new THREE.BoxGeometry(2.36, 1.52, 0.08);
  const bezelMat = new THREE.MeshStandardMaterial({
    color: 0x2e2440,
    roughness: 0.42,
    metalness: 0.35,
  });

  interface Screen {
    group: THREE.Group;
    face: THREE.Mesh;
    faceMat: THREE.MeshBasicMaterial;
    texture: THREE.CanvasTexture;
    home: THREE.Vector3;
    tilt: number;
    wake: number;
    bob: number;
  }

  const screens: Screen[] = [];

  for (let i = 0; i < SCREENS; i += 1) {
    const accent = ACCENTS[i % ACCENTS.length]!;
    const texture = screenTexture(accent);

    const faceMat = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      opacity: 0,
      toneMapped: false,
    });

    const face = new THREE.Mesh(screenGeo, faceMat);
    face.position.z = 0.05;

    const bezel = new THREE.Mesh(bezelGeo, bezelMat);

    const group = new THREE.Group();
    group.add(bezel, face);

    /*
      An even ring around the hub, phased so screen 0 lands on the left — that
      is the one the opening shot holds on.

      The phase is what does the work here. Giving screen 0 a hardcoded angle
      instead left its own slot in the ring empty *and* dropped it on top of a
      neighbour, which read as two screens overlapping on the left and one
      missing from the upper right.
    */
    const angle = Math.PI + (i / SCREENS) * Math.PI * 2;

    // Radius and depth vary, but only within a band: enough to keep the field
    // from looking stamped, not enough to reintroduce overlap in perspective.
    const radius = 5.1 + rand() * 1.3;

    const home = new THREE.Vector3(
      Math.cos(angle) * radius,
      Math.sin(angle) * (2.2 + rand() * 0.9),
      -1.4 - rand() * 2.6,
    );

    group.position.copy(home);

    // Turn each screen to face the hub, so the field reads as an arrangement
    // around a centre rather than a scatter.
    const tilt = Math.atan2(HUB.x - home.x, HUB.z - home.z);
    group.rotation.y = tilt;

    scene.add(group);

    screens.push({
      group,
      face,
      faceMat,
      texture,
      home,
      tilt,
      // The first wakes immediately; the rest stagger across the second beat.
      wake: i === 0 ? 0 : 0.18 + (i / SCREENS) * 0.2,
      bob: rand() * Math.PI * 2,
    });
  }

  /* ------------------------------- ribbons ------------------------------ */
  // One tube per screen, curving from it to the hub. The flow is a scrolling
  // texture rather than moving geometry.
  const flowMap = flowTexture();

  interface Ribbon {
    mesh: THREE.Mesh;
    material: THREE.MeshBasicMaterial;
    map: THREE.Texture;
    offset: number;
  }

  const ribbons: Ribbon[] = [];

  for (let i = 0; i < SCREENS; i += 1) {
    const from = screens[i]!.home;

    // Bow the curve out and up so signals arc rather than sliding down a chord.
    const mid = from.clone().lerp(HUB, 0.5);
    mid.y += 1.6 + rand() * 1.1;
    mid.z += 1.4;

    const curve = new THREE.CatmullRomCurve3([
      from.clone(),
      from.clone().lerp(mid, 0.5),
      mid,
      mid.clone().lerp(HUB, 0.6),
      HUB.clone(),
    ]);

    const geo = new THREE.TubeGeometry(curve, 64, 0.028, 8, false);

    // Each ribbon gets its own texture instance so the offsets can differ.
    const map = flowMap.clone();
    map.needsUpdate = true;
    map.wrapS = THREE.RepeatWrapping;
    map.repeat.set(3, 1);

    const material = new THREE.MeshBasicMaterial({
      map,
      color: new THREE.Color(ACCENTS[i % ACCENTS.length]!),
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });

    const mesh = new THREE.Mesh(geo, material);
    scene.add(mesh);

    ribbons.push({ mesh, material, map, offset: rand() });
  }

  /* ------------------------------- aperture ----------------------------- */
  // Six blades that rotate and retract to open the iris, plus a rim that
  // brightens as it takes the flow.
  const apertureGroup = new THREE.Group();
  apertureGroup.position.copy(HUB);
  scene.add(apertureGroup);

  const bladeGeo = new THREE.BoxGeometry(1.5, 0.055, 0.055);
  const bladeMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: new THREE.Color(GOLD),
    emissiveIntensity: 1.6,
    roughness: 0.3,
    metalness: 0.4,
    toneMapped: false,
    transparent: true,
    opacity: 0,
  });

  const blades: THREE.Mesh[] = [];
  for (let i = 0; i < BLADES; i += 1) {
    const blade = new THREE.Mesh(bladeGeo, bladeMat);
    const angle = (i / BLADES) * Math.PI * 2;
    blade.userData.angle = angle;
    apertureGroup.add(blade);
    blades.push(blade);
  }

  const rimGeo = new THREE.TorusGeometry(1.15, 0.016, 10, 96);
  const rimMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: new THREE.Color(VIOLET),
    emissiveIntensity: 2.4,
    roughness: 0.3,
    toneMapped: false,
    transparent: true,
    opacity: 0,
  });
  const apertureRim = new THREE.Mesh(rimGeo, rimMat);
  apertureGroup.add(apertureRim);

  /* -------------------------------- inbox ------------------------------- */
  // The flow resolves into a stacked column of entries, each with a category
  // dot. This is the payoff shot: one legible list.
  const inbox = new THREE.Group();
  inbox.position.copy(HUB);
  scene.add(inbox);

  const rowGeo = new THREE.BoxGeometry(3.1, 0.14, 0.05);
  const rowMat = new THREE.MeshStandardMaterial({
    color: 0x3b2f52,
    roughness: 0.5,
    metalness: 0.2,
    transparent: true,
    opacity: 0,
  });

  const dotGeo = new THREE.SphereGeometry(0.052, 12, 12);

  interface Row {
    row: THREE.Mesh;
    dot: THREE.Mesh;
    dotMat: THREE.MeshStandardMaterial;
    targetY: number;
    delay: number;
  }

  const rows: Row[] = [];

  for (let i = 0; i < ENTRIES; i += 1) {
    const row = new THREE.Mesh(rowGeo, rowMat);
    const targetY = 1.35 - i * 0.185;
    row.position.set(0, targetY, 0);

    const dotMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: new THREE.Color(ACCENTS[i % ACCENTS.length]!),
      emissiveIntensity: 2,
      roughness: 0.3,
      toneMapped: false,
      transparent: true,
      opacity: 0,
    });

    const dot = new THREE.Mesh(dotGeo, dotMat);
    dot.position.set(-1.4, targetY, 0.04);

    inbox.add(row, dot);
    rows.push({ row, dot, dotMat, targetY, delay: i / ENTRIES });
  }

  /* --------------------------------- dust ------------------------------- */
  const dustGeo = new THREE.BufferGeometry();
  const dustPos = new Float32Array(DUST * 3);
  for (let i = 0; i < DUST; i += 1) {
    dustPos[i * 3] = (rand() - 0.5) * 46;
    dustPos[i * 3 + 1] = (rand() - 0.5) * 26;
    dustPos[i * 3 + 2] = -24 + rand() * 30;
  }
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));

  const moteMap = moteTexture();
  const dustMat = new THREE.PointsMaterial({
    size: 0.13,
    map: moteMap,
    color: VIOLET,
    transparent: true,
    opacity: 0.45,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
  });
  const dust = new THREE.Points(dustGeo, dustMat);
  scene.add(dust);

  /* ----------------------------- postprocessing ------------------------- */
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));

  let bloom: UnrealBloomPass | null = null;
  if (quality === 'high') {
    bloom = new UnrealBloomPass(new THREE.Vector2(width(), height()), 0.78, 0.82, 0.2);
    composer.addPass(bloom);
  }

  composer.addPass(new OutputPass());
  composer.setSize(width(), height());

  /* -------------------------------- loop -------------------------------- */
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
    const t = animate ? clock.getElapsedTime() : 6;

    // Beats.
    const fieldReveal = phase(p, 0.16, 0.42);
    const signal = phase(p, 0.4, 0.62);
    const irisOpen = phase(p, 0.58, 0.8);
    const resolveInbox = phase(p, 0.78, 0.98);

    // Screens: wake in sequence, breathe, then dim as the inbox takes over.
    for (let i = 0; i < screens.length; i += 1) {
      const s = screens[i]!;
      const woken = phase(p, s.wake, s.wake + 0.16);
      const dim = 1 - resolveInbox * 0.85;

      s.faceMat.opacity = woken * dim;
      s.group.visible = woken > 0.01;

      // Drift outward a touch as the field reveals, so it opens up.
      const spread = 1 + fieldReveal * 0.08;
      s.group.position.set(
        s.home.x * spread,
        s.home.y * spread + (animate ? Math.sin(t * 0.5 + s.bob) * 0.12 : 0),
        s.home.z,
      );

      // Turn slightly toward the camera as the iris opens.
      s.group.rotation.y = s.tilt * (1 - irisOpen * 0.25);
      s.group.scale.setScalar(0.9 + woken * 0.1 - resolveInbox * 0.15);
    }

    // Ribbons: ignite, flow, then fade once the inbox is established.
    for (let i = 0; i < ribbons.length; i += 1) {
      const r = ribbons[i]!;
      const live = signal * (1 - resolveInbox * 0.9);

      r.material.opacity = live * 0.85;
      r.mesh.visible = live > 0.01;

      if (animate) {
        // Negative, so the light travels from the screen toward the hub.
        r.map.offset.x = -(t * 0.16 + r.offset) % 1;
      }
    }

    // Aperture: blades rotate and retract, rim brightens.
    for (let i = 0; i < blades.length; i += 1) {
      const blade = blades[i]!;
      const angle = blade.userData.angle as number;
      const spin = angle + irisOpen * 0.9 + (animate ? t * 0.06 : 0);
      const reach = lerp(0.42, 1.02, irisOpen);

      blade.position.set(Math.cos(spin) * reach, Math.sin(spin) * reach, 0);
      blade.rotation.z = spin + Math.PI / 2;
      blade.scale.x = lerp(0.55, 1, irisOpen);
    }

    bladeMat.opacity = phase(p, 0.5, 0.66) * (1 - resolveInbox * 0.8) * 0.9;
    rimMat.opacity = phase(p, 0.54, 0.7) * (1 - resolveInbox * 0.7) * 0.85;
    apertureRim.scale.setScalar(0.7 + irisOpen * 0.45);
    apertureGroup.rotation.z = animate ? t * 0.05 : 0;

    // The hub lights the room as the flow arrives.
    hubLight.intensity =
      (signal * 18 + resolveInbox * 26) * (animate ? 1 + Math.sin(t * 1.4) * 0.08 : 1);

    // Inbox: entries land one after another, bottom-weighted.
    inbox.visible = resolveInbox > 0.01;
    for (let i = 0; i < rows.length; i += 1) {
      const r = rows[i]!;
      const landed = phase(p, 0.78 + r.delay * 0.14, 0.86 + r.delay * 0.14);

      r.row.position.y = lerp(r.targetY + 1.4, r.targetY, landed);
      r.row.scale.x = lerp(0.4, 1, landed);
      r.dot.position.y = r.row.position.y;
      r.dotMat.opacity = landed;
    }
    rowMat.opacity = resolveInbox * 0.9;

    if (animate) {
      dust.rotation.z = t * 0.008;
      violetRim.intensity = 40 + Math.sin(t * 0.7) * 7;
      goldRim.intensity = 22 + Math.cos(t * 0.55) * 5;
    }

    // Camera: sample the keyframed path, then damp toward it. Damping is
    // frame-rate independent so the shot reads the same at 60 and 120 Hz.
    const shot = sampleCam(p);
    const px = animate ? pointerRef.current.x * 0.75 : 0;
    const py = animate ? pointerRef.current.y * 0.45 : 0;

    const k = 1 - Math.pow(0.0016, delta);
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

      screenGeo.dispose();
      bezelGeo.dispose();
      bezelMat.dispose();
      for (const s of screens) {
        s.faceMat.dispose();
        s.texture.dispose();
      }

      for (const r of ribbons) {
        r.mesh.geometry.dispose();
        r.material.dispose();
        r.map.dispose();
      }
      flowMap.dispose();

      bladeGeo.dispose();
      bladeMat.dispose();
      rimGeo.dispose();
      rimMat.dispose();

      rowGeo.dispose();
      rowMat.dispose();
      dotGeo.dispose();
      for (const r of rows) r.dotMat.dispose();

      dustGeo.dispose();
      dustMat.dispose();
      moteMap.dispose();

      composer.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
