'use client';

import * as React from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

import { usePrefersReducedMotion } from '@/lib/use-media-query';
import { useTheme } from '@/components/theme-provider';
import { NetworkFallback } from './network-fallback';
import { scrollState, smoothstep, useScrollProgress } from '@/lib/scroll-progress';

/**
 * Hero scene: feedback in flight.
 *
 * A literal picture of what the product does. Browser windows — the developer's
 * projects — float in depth around a central hub, the Feedex dashboard. Each
 * window emits pieces of feedback that arc inward along curved paths and land
 * at the hub.
 *
 * This replaced an abstract node graph that said nothing about the product and
 * was tuned so far down that visitors reported a flat background. This version
 * is deliberately present: real geometry, real depth, motion large enough to
 * read at a glance.
 *
 * Constraints it still respects:
 *   - A handful of draw calls; messages share one instanced mesh.
 *   - Textures are drawn procedurally to a 2D canvas — no assets to load.
 *   - Under `prefers-reduced-motion` the composition renders as a still frame
 *     rather than disappearing.
 *   - If WebGL is unavailable, an SVG fallback renders instead.
 */

const GOLD = '#F7B83D';
const VIOLET = '#B58BF9';

/** The projects, arranged in a loose arc with real depth separation. */
interface WindowSpec {
  position: THREE.Vector3;
  rotation: [number, number, number];
  scale: number;
  accent: string;
  /** Phase offset so nothing floats in unison. */
  phase: number;
}

/**
 * Four windows at the corners rather than five in an arc.
 *
 * The composition has to frame the headline, not sit under it: anything near
 * the centre column competes with the copy, and the copy always wins. Pushed
 * wide and back, they read as depth around the message instead of clutter
 * behind it.
 */
const WINDOWS: WindowSpec[] = [
  {
    position: new THREE.Vector3(-5.35, 1.9, -2.3),
    rotation: [0.06, 0.46, -0.04],
    scale: 1.02,
    accent: GOLD,
    phase: 0,
  },
  {
    position: new THREE.Vector3(-4.5, -2.35, -0.6),
    rotation: [-0.07, 0.34, 0.05],
    scale: 0.86,
    accent: VIOLET,
    phase: 1.9,
  },
  {
    position: new THREE.Vector3(5.45, 1.55, -2.1),
    rotation: [0.05, -0.44, 0.04],
    scale: 0.98,
    accent: VIOLET,
    phase: 3.4,
  },
  {
    position: new THREE.Vector3(4.7, -2.5, -0.8),
    rotation: [-0.06, -0.32, -0.05],
    scale: 0.84,
    accent: GOLD,
    phase: 5.1,
  },
];

const HUB = new THREE.Vector3(0, -1.05, 0.4);

/**
 * Draws a small browser window to a canvas and returns it as a texture.
 *
 * Procedural rather than an image file: it keeps the scene asset-free, and the
 * accent colour has to vary per window anyway.
 */
function createWindowTexture(accent: string, dark: boolean): THREE.CanvasTexture {
  const w = 320;
  const h = 208;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;

  const ctx = canvas.getContext('2d')!;
  const radius = 16;

  const surface = dark ? '#221930' : '#FFFFFF';
  const chrome = dark ? '#2C2140' : '#F0ECE3';
  const line = dark ? 'rgba(255,255,255,0.14)' : 'rgba(23,16,31,0.11)';
  const border = dark ? 'rgba(255,255,255,0.16)' : 'rgba(23,16,31,0.12)';

  ctx.beginPath();
  ctx.roundRect(0, 0, w, h, radius);
  ctx.fillStyle = surface;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = border;
  ctx.stroke();

  // Title bar
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(0, 0, w, 40, [radius, radius, 0, 0]);
  ctx.clip();
  ctx.fillStyle = chrome;
  ctx.fillRect(0, 0, w, 40);
  ctx.restore();

  for (let i = 0; i < 3; i += 1) {
    ctx.beginPath();
    ctx.arc(24 + i * 20, 20, 5, 0, Math.PI * 2);
    ctx.fillStyle = dark ? 'rgba(255,255,255,0.24)' : 'rgba(23,16,31,0.16)';
    ctx.fill();
  }

  // The project's accent, as it appears in the dashboard.
  ctx.beginPath();
  ctx.roundRect(96, 14, 74, 12, 6);
  ctx.fillStyle = accent;
  ctx.globalAlpha = 0.85;
  ctx.fill();
  ctx.globalAlpha = 1;

  // Content lines, varying width so it reads as a real page.
  const widths = [0.82, 0.64, 0.73, 0.46, 0.58];
  for (let i = 0; i < widths.length; i += 1) {
    ctx.beginPath();
    ctx.roundRect(24, 66 + i * 22, (w - 48) * widths[i]!, 9, 5);
    ctx.fillStyle = line;
    ctx.fill();
  }

  // The widget's own button, in the corner where it actually sits.
  ctx.beginPath();
  ctx.roundRect(w - 94, h - 36, 70, 24, 12);
  ctx.fillStyle = accent;
  ctx.fill();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function ProjectWindow({
  spec,
  dark,
  reducedMotion,
}: {
  spec: WindowSpec;
  dark: boolean;
  reducedMotion: boolean;
}) {
  const groupRef = React.useRef<THREE.Group>(null);
  const texture = React.useMemo(() => createWindowTexture(spec.accent, dark), [spec.accent, dark]);

  React.useEffect(() => () => texture.dispose(), [texture]);

  useFrame(({ clock }) => {
    const group = groupRef.current;
    if (!group) return;

    // Scroll draws the windows toward the hub. This is the product's whole
    // claim rendered as motion: separate projects converging into one place.
    const converge = smoothstep(0.05, 0.85, scrollState.narrative);
    const base = spec.position.clone().lerp(HUB, converge * 0.72);

    if (reducedMotion) {
      group.position.copy(base);
      return;
    }

    const t = clock.getElapsedTime();
    // Float amplitude decays as they converge, so the arrival settles.
    const drift = 1 - converge * 0.8;
    group.position.set(
      base.x + Math.cos(t * 0.36 + spec.phase) * 0.13 * drift,
      base.y + Math.sin(t * 0.55 + spec.phase) * 0.24 * drift,
      base.z,
    );
    group.rotation.z = spec.rotation[2] + Math.sin(t * 0.42 + spec.phase) * 0.04 * drift;
    group.scale.setScalar(spec.scale * (1 - converge * 0.42));
  });

  return (
    <group ref={groupRef} position={spec.position} rotation={spec.rotation} scale={spec.scale}>
      <mesh>
        <planeGeometry args={[2.05, 1.33]} />
        <meshBasicMaterial map={texture} transparent opacity={dark ? 0.94 : 0.98} />
      </mesh>

      {/* A soft accent glow, so each window separates from the ground. */}
      <mesh position={[0, 0, -0.02]} scale={1.16}>
        <planeGeometry args={[2.05, 1.33]} />
        <meshBasicMaterial
          color={spec.accent}
          transparent
          opacity={dark ? 0.1 : 0.07}
          blending={dark ? THREE.AdditiveBlending : THREE.NormalBlending}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

/**
 * The paths feedback travels: a quadratic curve from each window to the hub,
 * bowed outward so messages arc rather than sliding along a chord.
 */
function useFlightPaths(): THREE.QuadraticBezierCurve3[] {
  return React.useMemo(
    () =>
      WINDOWS.map((spec) => {
        const mid = spec.position.clone().lerp(HUB, 0.5);
        mid.y += 1.1;
        mid.z += 1.2;
        return new THREE.QuadraticBezierCurve3(spec.position.clone(), mid, HUB.clone());
      }),
    [],
  );
}

function FlightLines({ dark }: { dark: boolean }) {
  const paths = useFlightPaths();

  const geometry = React.useMemo(() => {
    const positions: number[] = [];

    for (const path of paths) {
      const points = path.getPoints(28);
      for (let i = 0; i < points.length - 1; i += 1) {
        const a = points[i]!;
        const b = points[i + 1]!;
        positions.push(a.x, a.y, a.z, b.x, b.y, b.z);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    return geo;
  }, [paths]);

  React.useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial color={VIOLET} transparent opacity={dark ? 0.28 : 0.36} />
    </lineSegments>
  );
}

/**
 * Feedback in flight.
 *
 * Several messages per path, spaced along it, so there is always motion
 * somewhere rather than long gaps between single particles.
 */
const MESSAGES_PER_PATH = 3;

function Messages({ dark, reducedMotion }: { dark: boolean; reducedMotion: boolean }) {
  const paths = useFlightPaths();
  const meshRef = React.useRef<THREE.InstancedMesh>(null);
  const dummy = React.useMemo(() => new THREE.Object3D(), []);
  const total = paths.length * MESSAGES_PER_PATH;

  React.useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    paths.forEach((_, pathIndex) => {
      for (let i = 0; i < MESSAGES_PER_PATH; i += 1) {
        mesh.setColorAt(
          pathIndex * MESSAGES_PER_PATH + i,
          new THREE.Color(WINDOWS[pathIndex]!.accent),
        );
      }
    });

    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [paths]);

  const place = React.useCallback(
    (time: number) => {
      const mesh = meshRef.current;
      if (!mesh) return;

      paths.forEach((path, pathIndex) => {
        for (let i = 0; i < MESSAGES_PER_PATH; i += 1) {
          const index = pathIndex * MESSAGES_PER_PATH + i;
          const offset = i / MESSAGES_PER_PATH + pathIndex * 0.13;
          // Traffic intensifies as the windows converge.
          const rush = 1 + smoothstep(0.1, 0.9, scrollState.narrative) * 1.6;
          const progress = (time * 0.19 * rush + offset) % 1;

          dummy.position.copy(path.getPoint(progress));

          // Fade in on departure and out on arrival, swelling at the midpoint,
          // so each message reads as a discrete object in flight.
          const fade = Math.sin(progress * Math.PI);
          dummy.scale.setScalar(0.05 + fade * 0.06);
          dummy.updateMatrix();
          mesh.setMatrixAt(index, dummy.matrix);
        }
      });

      mesh.instanceMatrix.needsUpdate = true;
    },
    [paths, dummy],
  );

  // Paint a correct first frame even when the loop never advances, which is
  // exactly the case under reduced motion.
  React.useLayoutEffect(() => {
    place(reducedMotion ? 2.4 : 0);
  }, [place, reducedMotion]);

  useFrame(({ clock }) => {
    if (reducedMotion) return;
    place(clock.getElapsedTime());
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, total]}>
      <sphereGeometry args={[1, 14, 14]} />
      <meshBasicMaterial
        color="#ffffff"
        transparent
        opacity={1}
        blending={dark ? THREE.AdditiveBlending : THREE.NormalBlending}
        depthWrite={false}
      />
    </instancedMesh>
  );
}

/** The dashboard: where everything arrives. */
function Hub({ dark, reducedMotion }: { dark: boolean; reducedMotion: boolean }) {
  const ringRef = React.useRef<THREE.Mesh>(null);
  const ring2Ref = React.useRef<THREE.Mesh>(null);
  const glowRef = React.useRef<THREE.Mesh>(null);

  const groupRef = React.useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    // The hub swells as the windows land — the dashboard filling up.
    const arrive = smoothstep(0.15, 0.95, scrollState.narrative);
    if (groupRef.current) groupRef.current.scale.setScalar(1 + arrive * 0.85);

    if (reducedMotion) return;
    const t = clock.getElapsedTime();

    if (ringRef.current) ringRef.current.rotation.z = t * (0.34 + arrive * 0.5);
    if (ring2Ref.current) ring2Ref.current.rotation.z = -t * (0.22 + arrive * 0.4);
    if (glowRef.current) {
      glowRef.current.scale.setScalar(1 + Math.sin(t * 1.5) * 0.15 + arrive * 0.5);
    }
  });

  return (
    <group ref={groupRef} position={HUB}>
      <mesh ref={glowRef}>
        <circleGeometry args={[0.95, 48]} />
        <meshBasicMaterial
          color={VIOLET}
          transparent
          opacity={dark ? 0.15 : 0.1}
          blending={dark ? THREE.AdditiveBlending : THREE.NormalBlending}
          depthWrite={false}
        />
      </mesh>

      <mesh ref={ringRef}>
        <torusGeometry args={[0.58, 0.012, 8, 64]} />
        <meshBasicMaterial color={VIOLET} transparent opacity={dark ? 0.8 : 0.62} />
      </mesh>

      <mesh ref={ring2Ref} rotation={[0.9, 0.3, 0]}>
        <torusGeometry args={[0.41, 0.01, 8, 64]} />
        <meshBasicMaterial color={GOLD} transparent opacity={dark ? 0.65 : 0.55} />
      </mesh>

      <mesh>
        <icosahedronGeometry args={[0.18, 1]} />
        <meshBasicMaterial color={dark ? VIOLET : '#8B5FD6'} />
      </mesh>
    </group>
  );
}

/** Depth: a scatter of faint points well behind everything else. */
function Depth({ dark }: { dark: boolean }) {
  const geometry = React.useMemo(() => {
    const positions: number[] = [];

    // Deterministic scatter, so server and client agree and the layout is
    // stable between reloads.
    for (let i = 0; i < 90; i += 1) {
      const a = Math.sin(i * 12.9898) * 43758.5453;
      const b = Math.sin(i * 78.233) * 12345.6789;
      const c = Math.sin(i * 39.425) * 24680.1357;
      positions.push(
        (a - Math.floor(a) - 0.5) * 22,
        (b - Math.floor(b) - 0.5) * 13,
        -4 - (c - Math.floor(c)) * 7,
      );
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    return geo;
  }, []);

  React.useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <points geometry={geometry}>
      <pointsMaterial
        color={dark ? '#B58BF9' : '#8B7F99'}
        size={0.055}
        sizeAttenuation
        transparent
        opacity={dark ? 0.5 : 0.35}
      />
    </points>
  );
}

/** Cinematic drift plus pointer parallax, applied to the whole composition. */
function Scene({ dark, reducedMotion }: { dark: boolean; reducedMotion: boolean }) {
  const groupRef = React.useRef<THREE.Group>(null);
  const { viewport, camera, invalidate } = useThree();

  // With the loop stopped under reduced motion, scrolling still has to repaint,
  // otherwise the convergence would never be seen at all.
  React.useEffect(() => {
    if (!reducedMotion) return;
    const onScroll = () => invalidate();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [reducedMotion, invalidate]);

  useFrame(({ clock, pointer }) => {
    const group = groupRef.current;
    if (!group) return;

    // A slow dolly forward, so the scene deepens rather than merely moving.
    const target = 9.6 - smoothstep(0, 1, scrollState.narrative) * 2.6;
    camera.position.z += (target - camera.position.z) * (reducedMotion ? 1 : 0.06);

    if (reducedMotion) {
      group.rotation.set(0, scrollState.narrative * 0.34, 0);
      return;
    }

    const t = clock.getElapsedTime();
    const progress = scrollState.narrative;

    const targetY = pointer.x * 0.13 + Math.sin(t * 0.16) * 0.075 + progress * 0.34;
    const targetX = -pointer.y * 0.09 + Math.cos(t * 0.13) * 0.045 - progress * 0.2;

    // Eased toward the target so the view trails the pointer rather than
    // snapping to it — the difference between cinematic and twitchy.
    group.rotation.y += (targetY - group.rotation.y) * 0.035;
    group.rotation.x += (targetX - group.rotation.x) * 0.035;
  });

  // Shrink on narrow viewports so the composition stays inside the frame.
  const scale = Math.min(1, Math.max(0.46, viewport.width / 15));

  return (
    <group ref={groupRef} scale={scale}>
      <Depth dark={dark} />
      <FlightLines dark={dark} />
      {WINDOWS.map((spec) => (
        <ProjectWindow
          key={`${spec.position.x}:${spec.position.y}`}
          spec={spec}
          dark={dark}
          reducedMotion={reducedMotion}
        />
      ))}
      <Messages dark={dark} reducedMotion={reducedMotion} />
      <Hub dark={dark} reducedMotion={reducedMotion} />
    </group>
  );
}

/**
 * Whether this browser can actually give us a WebGL context.
 *
 * Checked lazily in the browser, because the answer is invisible from the
 * server: a blocked GPU or disabled hardware acceleration looks identical to a
 * working browser until the context is requested.
 */
function detectWebGL(): boolean {
  if (typeof window === 'undefined') return false;

  try {
    const canvas = document.createElement('canvas');
    const gl =
      canvas.getContext('webgl2') ??
      canvas.getContext('webgl') ??
      canvas.getContext('experimental-webgl');
    return Boolean(gl);
  } catch {
    return false;
  }
}

/**
 * Support is a fixed property of the browser, so it is probed once and cached
 * rather than re-tested on every render. Creating a throwaway context is not
 * free, and the answer cannot change within a session.
 */
let webglSupport: boolean | null = null;

function getWebGLSupport(): boolean {
  webglSupport ??= detectWebGL();
  return webglSupport;
}

/** Capability never changes, so there is nothing to subscribe to. */
function subscribeToNothing(): () => void {
  return () => {};
}

export function FeedbackNetwork({ className }: { className?: string }) {
  useScrollProgress();
  const reducedMotion = usePrefersReducedMotion();
  const { resolved } = useTheme();
  const dark = resolved === 'dark';

  // Read as external state rather than mirrored into an effect, so the first
  // client render already picks the right branch instead of flashing an empty
  // container. This component is client-only, so the server snapshot is never
  // actually used.
  const webgl = React.useSyncExternalStore(subscribeToNothing, getWebGLSupport, () => true);

  if (!webgl) return <NetworkFallback className={className} />;

  return (
    <div className={className} aria-hidden>
      <Canvas
        camera={{ position: [0, 0, 9.6], fov: 46 }}
        // Capped so the scene does not render at 3x on high-density displays
        // for no visible benefit.
        dpr={[1, 1.75]}
        gl={{ antialias: true, alpha: true, powerPreference: 'low-power' }}
        // Under reduced motion nothing changes between frames, so the loop is
        // stopped after the first paint rather than spinning at 60fps.
        frameloop={reducedMotion ? 'demand' : 'always'}
      >
        <Scene dark={dark} reducedMotion={reducedMotion} />
      </Canvas>
    </div>
  );
}

export default FeedbackNetwork;
