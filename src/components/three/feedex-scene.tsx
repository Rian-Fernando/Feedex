'use client';

import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';

/**
 * "The Inbox" — one continuous scene driven by scroll, staging the product
 * story in four acts:
 *
 *   1. Scattered   — five projects drifting in their own corners of space
 *   2. Instrumented — the widget lights up on each one
 *   3. Convergence — every project streams its feedback into a single point
 *   4. The inbox   — the point resolves into one dashboard
 *
 * Purely decorative. The page's real content is server-rendered HTML sitting
 * on top, and the canvas is aria-hidden.
 */

const GOLD = new THREE.Color('#F7B83D');
const VIOLET = new THREE.Color('#B58BF9');
const PLUM = '#17101F';

const PROJECTS = 5;
const STREAM_PER_PROJECT = 7;
const DUST = 190;

/* ----------------------------- act helpers ------------------------------ */

const seg = (p: number, a: number, b: number) => THREE.MathUtils.clamp((p - a) / (b - a), 0, 1);
const smooth = (t: number) => t * t * (3 - 2 * t);

/** Eased 0→1 across the scroll range [a, b]. The scene is written in these. */
const phase = (p: number, a: number, b: number) => smooth(seg(p, a, b));

interface SceneProps {
  progressRef: React.RefObject<number>;
  animate: boolean;
}

/* ------------------------------- textures ------------------------------- */

/**
 * A browser window, drawn to a canvas.
 *
 * Procedural rather than an image so the accent can vary per project and the
 * scene ships no assets. `lit` draws the widget button glowing, which is how
 * act two reads as "instrumented".
 */
function windowTexture(accent: string, lit: boolean): THREE.CanvasTexture {
  const w = 384;
  const h = 248;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  ctx.beginPath();
  ctx.roundRect(0, 0, w, h, 18);
  ctx.fillStyle = '#1E1529';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(255,255,255,0.16)';
  ctx.stroke();

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(0, 0, w, 44, [18, 18, 0, 0]);
  ctx.clip();
  ctx.fillStyle = '#2A1F3A';
  ctx.fillRect(0, 0, w, 44);
  ctx.restore();

  for (let i = 0; i < 3; i += 1) {
    ctx.beginPath();
    ctx.arc(26 + i * 21, 22, 5.5, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.26)';
    ctx.fill();
  }

  ctx.beginPath();
  ctx.roundRect(104, 15, 92, 14, 7);
  ctx.fillStyle = accent;
  ctx.globalAlpha = 0.8;
  ctx.fill();
  ctx.globalAlpha = 1;

  const widths = [0.86, 0.66, 0.78, 0.5, 0.62];
  for (let i = 0; i < widths.length; i += 1) {
    ctx.beginPath();
    ctx.roundRect(28, 74 + i * 25, (w - 56) * widths[i]!, 10, 5);
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fill();
  }

  // The Feedex widget, in the corner where it actually sits.
  if (lit) {
    ctx.shadowColor = accent;
    ctx.shadowBlur = 26;
  }
  ctx.beginPath();
  ctx.roundRect(w - 116, h - 42, 88, 28, 14);
  ctx.fillStyle = lit ? accent : 'rgba(255,255,255,0.18)';
  ctx.fill();
  ctx.shadowBlur = 0;

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

/** The dashboard the story resolves into. */
function dashboardTexture(): THREE.CanvasTexture {
  const w = 512;
  const h = 336;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  ctx.beginPath();
  ctx.roundRect(0, 0, w, h, 20);
  ctx.fillStyle = '#1E1529';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(181,139,249,0.4)';
  ctx.stroke();

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(0, 0, w, 46, [20, 20, 0, 0]);
  ctx.clip();
  ctx.fillStyle = '#2A1F3A';
  ctx.fillRect(0, 0, w, 46);
  ctx.restore();

  ctx.beginPath();
  ctx.roundRect(24, 16, 108, 14, 7);
  ctx.fillStyle = '#B58BF9';
  ctx.fill();

  // Feedback rows, each tagged with the project it came from.
  const accents = ['#F7B83D', '#B58BF9', '#F7B83D', '#B58BF9', '#F7B83D'];
  for (let i = 0; i < 5; i += 1) {
    const y = 68 + i * 52;

    ctx.beginPath();
    ctx.roundRect(20, y, w - 40, 42, 10);
    ctx.fillStyle = 'rgba(255,255,255,0.045)';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(40, y + 21, 6, 0, Math.PI * 2);
    ctx.fillStyle = accents[i]!;
    ctx.fill();

    ctx.beginPath();
    ctx.roundRect(58, y + 10, 250 - i * 22, 9, 5);
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fill();

    ctx.beginPath();
    ctx.roundRect(58, y + 25, 170 - i * 14, 7, 4);
    ctx.fillStyle = 'rgba(255,255,255,0.13)';
    ctx.fill();

    ctx.beginPath();
    ctx.roundRect(w - 92, y + 14, 52, 16, 8);
    ctx.fillStyle = 'rgba(181,139,249,0.28)';
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

/* -------------------------------- layout -------------------------------- */

/** Where each project sits while scattered, and where it aligns to. */
const LAYOUT = Array.from({ length: PROJECTS }, (_, i) => {
  const angle = (i / PROJECTS) * Math.PI * 2 + 0.4;

  return {
    accent: i % 2 === 0 ? '#F7B83D' : '#B58BF9',
    /** Act 1: scattered wide and deep. */
    scattered: new THREE.Vector3(
      Math.cos(angle) * (7.5 + (i % 3) * 1.6),
      Math.sin(angle) * (4.2 + (i % 2) * 1.3),
      -6 - (i % 4) * 3.4,
    ),
    /** Act 2: aligned into a readable arc facing the viewer. */
    aligned: new THREE.Vector3(
      Math.cos(angle) * 4.6,
      Math.sin(angle) * 2.5,
      -0.6 + Math.sin(i * 2.1) * 0.5,
    ),
    tilt: Math.cos(angle) * 0.34,
    phase: i * 1.27,
  };
});

const HUB = new THREE.Vector3(0, 0, 0);

/* -------------------------------- projects ------------------------------- */

function Projects({ progressRef, animate }: SceneProps) {
  const groupRefs = useRef<(THREE.Group | null)[]>([]);
  const litRefs = useRef<(THREE.Mesh | null)[]>([]);

  const plain = useMemo(() => LAYOUT.map((l) => windowTexture(l.accent, false)), []);
  const lit = useMemo(() => LAYOUT.map((l) => windowTexture(l.accent, true)), []);

  useEffect(
    () => () => {
      for (const t of plain) t.dispose();
      for (const t of lit) t.dispose();
    },
    [plain, lit],
  );

  useFrame((state) => {
    const p = progressRef.current ?? 0;
    const t = animate ? state.clock.elapsedTime : 0;

    const gather = phase(p, 0.08, 0.42); // scattered → aligned
    const instrument = phase(p, 0.34, 0.52); // widget lights up
    const converge = phase(p, 0.55, 0.84); // pulled into the hub
    const recede = phase(p, 0.8, 1); // step back for the dashboard

    LAYOUT.forEach((spec, i) => {
      const group = groupRefs.current[i];
      if (!group) return;

      const base = spec.scattered.clone().lerp(spec.aligned, gather);
      base.lerp(HUB, converge * 0.82);

      const drift = (1 - converge) * (animate ? 1 : 0);
      group.position.set(
        base.x + Math.cos(t * 0.4 + spec.phase) * 0.16 * drift,
        base.y + Math.sin(t * 0.55 + spec.phase) * 0.24 * drift,
        base.z,
      );

      // Turn to face the viewer as they align, then shrink into the hub.
      group.rotation.y = spec.tilt * (1 - gather * 0.75);
      group.rotation.z = Math.sin(t * 0.36 + spec.phase) * 0.03 * drift;
      group.scale.setScalar((0.62 + gather * 0.38) * (1 - converge * 0.72) * (1 - recede * 0.4));

      // Crossfade to the lit texture as the widget is installed.
      const litMesh = litRefs.current[i];
      if (litMesh) {
        const material = litMesh.material as THREE.MeshBasicMaterial;
        material.opacity = instrument * (1 - converge * 0.6);
      }
    });
  });

  return (
    <group>
      {LAYOUT.map((spec, i) => (
        <group
          key={i}
          ref={(el) => {
            groupRefs.current[i] = el;
          }}
        >
          <mesh>
            <planeGeometry args={[2.4, 1.55]} />
            <meshBasicMaterial map={plain[i]} transparent toneMapped={false} />
          </mesh>

          {/* The instrumented state, faded in over the plain one. */}
          <mesh
            position={[0, 0, 0.006]}
            ref={(el) => {
              litRefs.current[i] = el;
            }}
          >
            <planeGeometry args={[2.4, 1.55]} />
            <meshBasicMaterial map={lit[i]} transparent opacity={0} toneMapped={false} />
          </mesh>

          {/* Accent halo, so each project separates from the ground. */}
          <mesh position={[0, 0, -0.02]} scale={1.18}>
            <planeGeometry args={[2.4, 1.55]} />
            <meshBasicMaterial
              color={spec.accent}
              transparent
              opacity={0.12}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
              toneMapped={false}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/* -------------------------------- streams -------------------------------- */

/**
 * Feedback in flight.
 *
 * One instanced mesh for every particle on every path. Positions are computed
 * from the curve each frame rather than stored, so the paths can follow the
 * projects as they converge.
 */
function Streams({ progressRef, animate }: SceneProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const tint = useMemo(() => new THREE.Color(), []);
  const total = PROJECTS * STREAM_PER_PROJECT;

  useFrame((state) => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const p = progressRef.current ?? 0;
    const t = animate ? state.clock.elapsedTime : 8;

    const gather = phase(p, 0.08, 0.42);
    const flow = phase(p, 0.44, 0.72); // streams switch on
    const converge = phase(p, 0.55, 0.84);
    const settle = phase(p, 0.82, 1); // traffic dies down at the inbox

    LAYOUT.forEach((spec, i) => {
      const from = spec.scattered
        .clone()
        .lerp(spec.aligned, gather)
        .lerp(HUB, converge * 0.82);
      const mid = from.clone().lerp(HUB, 0.5);
      mid.y += 1.5 * (1 - converge * 0.6);
      mid.z += 1.2;

      for (let j = 0; j < STREAM_PER_PROJECT; j += 1) {
        const index = i * STREAM_PER_PROJECT + j;
        const offset = j / STREAM_PER_PROJECT + i * 0.11;
        const progress = (t * 0.16 + offset) % 1;

        // Quadratic bezier, evaluated inline — cheaper than rebuilding a curve
        // object every frame for every particle.
        const u = 1 - progress;
        dummy.position.set(
          u * u * from.x + 2 * u * progress * mid.x + progress * progress * HUB.x,
          u * u * from.y + 2 * u * progress * mid.y + progress * progress * HUB.y,
          u * u * from.z + 2 * u * progress * mid.z + progress * progress * HUB.z,
        );

        const fade = Math.sin(progress * Math.PI);
        const size = 0.055 * fade * flow * (1 - settle * 0.75);
        dummy.scale.setScalar(Math.max(size, 0.0001));
        dummy.updateMatrix();
        mesh.setMatrixAt(index, dummy.matrix);

        // Brighten toward white on arrival, which is what bloom picks up.
        tint.copy(i % 2 === 0 ? GOLD : VIOLET).lerp(new THREE.Color('#ffffff'), progress * 0.75);
        mesh.setColorAt(index, tint);
      }
    });

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, total]} frustumCulled={false}>
      <sphereGeometry args={[1, 12, 12]} />
      <meshBasicMaterial toneMapped={false} transparent depthWrite={false} />
    </instancedMesh>
  );
}

/* ---------------------------------- hub ---------------------------------- */

/** The point everything arrives at, which becomes the dashboard. */
function Inbox({ progressRef, animate }: SceneProps) {
  const coreRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const panelRef = useRef<THREE.Mesh>(null);

  const texture = useMemo(() => dashboardTexture(), []);
  useEffect(() => () => texture.dispose(), [texture]);

  useFrame((state) => {
    const p = progressRef.current ?? 0;
    const t = animate ? state.clock.elapsedTime : 6;

    const wake = phase(p, 0.42, 0.6); // starts receiving
    const charge = phase(p, 0.6, 0.86); // fills up
    const resolve = phase(p, 0.8, 0.98); // becomes the dashboard

    if (coreRef.current) {
      const s = (0.12 + charge * 0.26) * (1 - resolve);
      coreRef.current.scale.setScalar(Math.max(s, 0.0001));
      const m = coreRef.current.material as THREE.MeshBasicMaterial;
      // Drives toward white as it charges, so bloom flares on its own.
      m.color.copy(VIOLET).lerp(new THREE.Color('#ffffff'), charge * 0.85);
    }

    if (glowRef.current) {
      const pulse = animate ? Math.sin(t * 1.6) * 0.12 : 0;
      const s = (0.34 + wake * 0.4 + charge * 0.62 + pulse) * (1 - resolve * 0.7);
      glowRef.current.scale.setScalar(Math.max(s, 0.0001));
      const m = glowRef.current.material as THREE.MeshBasicMaterial;
      m.opacity = (0.08 + charge * 0.16) * (1 - resolve);
    }

    if (ringRef.current) {
      ringRef.current.rotation.z = t * 0.3;
      const s = (0.55 + charge * 0.55) * (1 - resolve);
      ringRef.current.scale.setScalar(Math.max(s, 0.0001));
      const m = ringRef.current.material as THREE.MeshBasicMaterial;
      m.opacity = wake * 0.7 * (1 - resolve);
    }

    if (panelRef.current) {
      const s = 0.6 + resolve * 0.4;
      panelRef.current.scale.setScalar(Math.max(s, 0.0001));
      panelRef.current.rotation.y = (1 - resolve) * 0.4;
      const m = panelRef.current.material as THREE.MeshBasicMaterial;
      m.opacity = resolve;
      panelRef.current.visible = resolve > 0.01;
    }
  });

  return (
    <group position={HUB}>
      <mesh ref={glowRef}>
        <circleGeometry args={[1, 48]} />
        <meshBasicMaterial
          color={VIOLET}
          transparent
          opacity={0.1}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      <mesh ref={ringRef}>
        <torusGeometry args={[1, 0.014, 8, 72]} />
        <meshBasicMaterial color={GOLD} transparent opacity={0} toneMapped={false} />
      </mesh>

      <mesh ref={coreRef}>
        <icosahedronGeometry args={[1, 2]} />
        <meshBasicMaterial color={VIOLET} toneMapped={false} />
      </mesh>

      {/* The dashboard the whole story resolves into. */}
      <mesh ref={panelRef} visible={false}>
        <planeGeometry args={[4.6, 3.02]} />
        <meshBasicMaterial map={texture} transparent opacity={0} toneMapped={false} />
      </mesh>
    </group>
  );
}

/* --------------------------------- depth --------------------------------- */

function Dust({ animate }: { animate: boolean }) {
  const ref = useRef<THREE.Points>(null);

  const geometry = useMemo(() => {
    const positions = new Float32Array(DUST * 3);
    for (let i = 0; i < DUST; i += 1) {
      // Deterministic scatter, stable between reloads.
      const a = Math.sin(i * 12.9898) * 43758.5453;
      const b = Math.sin(i * 78.233) * 12345.6789;
      const c = Math.sin(i * 39.425) * 24680.1357;
      positions[i * 3] = (a - Math.floor(a) - 0.5) * 34;
      positions[i * 3 + 1] = (b - Math.floor(b) - 0.5) * 20;
      positions[i * 3 + 2] = -6 - (c - Math.floor(c)) * 16;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return geo;
  }, []);

  useEffect(() => () => geometry.dispose(), [geometry]);

  useFrame((state) => {
    if (ref.current && animate) ref.current.rotation.z = state.clock.elapsedTime * 0.012;
  });

  return (
    <points ref={ref} geometry={geometry}>
      <pointsMaterial
        color="#B58BF9"
        size={0.06}
        sizeAttenuation
        transparent
        opacity={0.55}
        depthWrite={false}
      />
    </points>
  );
}

/* ---------------------------- camera choreography ------------------------ */

function Rig({
  progressRef,
  pointerRef,
  animate,
}: SceneProps & { pointerRef: React.RefObject<{ x: number; y: number }> }) {
  useFrame((state, delta) => {
    const p = progressRef.current ?? 0;
    const ptr = pointerRef.current ?? { x: 0, y: 0 };

    // Dolly: wide on the scattered projects → settle on the arc → push into
    // the convergence → pull back to reveal the dashboard.
    const z = 15 - phase(p, 0.05, 0.42) * 5.4 - phase(p, 0.5, 0.78) * 3.6 + phase(p, 0.8, 1) * 4.8;
    const y = phase(p, 0.1, 0.45) * 0.4 - phase(p, 0.55, 0.85) * 0.4;
    const x = Math.sin(p * Math.PI) * 1.4;

    const px = animate ? ptr.x * 0.7 : 0;
    const py = animate ? ptr.y * 0.4 : 0;

    // Frame-rate independent damping.
    const k = 1 - Math.pow(0.0016, delta);
    state.camera.position.x += (x + px - state.camera.position.x) * k;
    state.camera.position.y += (y + py - state.camera.position.y) * k;
    state.camera.position.z += (z - state.camera.position.z) * k;
    state.camera.lookAt(0, 0, 0);
  });

  return null;
}

/**
 * Static effect settings on purpose.
 *
 * These wrappers memoise on their props, and handing them anything that links
 * back into the scene graph throws on a circular structure. The act-three
 * flare is therefore driven physically instead — the core and the arriving
 * particles brighten toward white, and bloom responds to that luminance on its
 * own. That is both crash-free and closer to how light actually behaves.
 */
function Effects() {
  return (
    <EffectComposer>
      <Bloom mipmapBlur luminanceThreshold={0.3} luminanceSmoothing={0.5} intensity={1.1} />
      <Vignette offset={0.3} darkness={0.6} />
    </EffectComposer>
  );
}

/**
 * Eases the raw scroll value into the value the scene renders, so fast
 * scrolling glides instead of snapping. Priority -1 so every other frame
 * callback reads the already-smoothed number.
 */
function ProgressDamper({
  targetRef,
  progressRef,
  animate,
}: {
  targetRef: React.RefObject<number>;
  progressRef: React.RefObject<number>;
  animate: boolean;
}) {
  useFrame((_, delta) => {
    const target = targetRef.current ?? 0;

    if (!animate) {
      progressRef.current = target;
      return;
    }

    const k = 1 - Math.pow(0.01, Math.min(delta, 0.1));
    progressRef.current += (target - progressRef.current) * k;
  }, -1);

  return null;
}

export default function FeedexScene({
  targetRef,
  pointerRef,
  animate,
  quality,
  active,
}: {
  targetRef: React.RefObject<number>;
  pointerRef: React.RefObject<{ x: number; y: number }>;
  animate: boolean;
  quality: 'high' | 'low';
  active: boolean;
}) {
  // Starts at zero and the damper converges on the first frames; reading
  // `targetRef` here would be a ref access during render.
  const progressRef = useRef(0);

  return (
    <Canvas
      dpr={quality === 'high' ? [1, 1.8] : [1, 1.2]}
      camera={{ position: [0, 0, 15], fov: 46 }}
      gl={{ antialias: quality === 'high', powerPreference: 'high-performance' }}
      // Stop rendering entirely when the tab is not being looked at.
      frameloop={active ? 'always' : 'never'}
      style={{ background: PLUM }}
    >
      <fog attach="fog" args={[PLUM, 14, 44]} />

      <ProgressDamper targetRef={targetRef} progressRef={progressRef} animate={animate} />

      <Dust animate={animate} />
      <Projects progressRef={progressRef} animate={animate} />
      <Streams progressRef={progressRef} animate={animate} />
      <Inbox progressRef={progressRef} animate={animate} />

      <Rig progressRef={progressRef} pointerRef={pointerRef} animate={animate} />
      {quality === 'high' && <Effects />}
    </Canvas>
  );
}
