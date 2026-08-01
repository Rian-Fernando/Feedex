'use client';

import * as React from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

import { usePrefersReducedMotion } from '@/lib/use-media-query';
import { useTheme } from '@/components/theme-provider';

/**
 * Hero visualisation: a feedback network.
 *
 * Outer nodes are projects; the centre is the Feedex dashboard. Pulses travel
 * inward along the edges, which is literally what the product does — many
 * sources, one destination.
 *
 * Restraint is the point. No bloom, no post-processing, no camera acrobatics.
 * The scene is small, renders on demand where possible, and yields entirely to
 * `prefers-reduced-motion`.
 */

const NODE_COUNT = 10;
const RADIUS = 3.9;

/**
 * Brand duotone. Gold is the customer's voice, violet the developer's response,
 * so the outer nodes alternate between them and the core — the dashboard — is
 * violet. The two hues are the same colours the mark uses, not approximations.
 */
const GOLD = new THREE.Color('#F7B83D');
const VIOLET = new THREE.Color('#B58BF9');
const EDGE = new THREE.Color('#B58BF9');

interface NodeSpec {
  position: THREE.Vector3;
  scale: number;
  /** Phase offset so nodes do not breathe in unison. */
  phase: number;
  /** Which side of the loop this node belongs to. */
  voice: 'customer' | 'developer';
}

function useNodes(): NodeSpec[] {
  return React.useMemo(() => {
    const nodes: NodeSpec[] = [];

    for (let i = 0; i < NODE_COUNT; i += 1) {
      const angle = (i / NODE_COUNT) * Math.PI * 2;
      // Deterministic pseudo-random offsets keep the layout organic while
      // staying identical between server and client renders.
      const wobble = Math.sin(i * 12.9898) * 0.5;
      const radius = RADIUS + wobble * 0.5;

      nodes.push({
        position: new THREE.Vector3(
          Math.cos(angle) * radius,
          Math.sin(angle) * radius * 0.62,
          Math.sin(i * 7.233) * 0.9,
        ),
        scale: 0.115 + Math.abs(wobble) * 0.05,
        phase: i * 0.9,
        // Alternating rather than random, so neither hue ever clusters.
        voice: i % 2 === 0 ? 'customer' : 'developer',
      });
    }

    return nodes;
  }, []);
}

/** The converging edges, drawn as one merged line geometry. */
function Edges({ nodes, dark }: { nodes: NodeSpec[]; dark: boolean }) {
  const geometry = React.useMemo(() => {
    const positions: number[] = [];

    for (const node of nodes) {
      positions.push(node.position.x, node.position.y, node.position.z, 0, 0, 0);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    return geo;
  }, [nodes]);

  React.useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <lineSegments geometry={geometry}>
      {/* Thin violet lines need more alpha to register against paper. */}
      <lineBasicMaterial color={EDGE} transparent opacity={dark ? 0.45 : 0.6} />
    </lineSegments>
  );
}

/** Project nodes, gently breathing. */
function Nodes({
  nodes,
  reducedMotion,
  dark,
}: {
  nodes: NodeSpec[];
  reducedMotion: boolean;
  dark: boolean;
}) {
  const meshRef = React.useRef<THREE.InstancedMesh>(null);
  const dummy = React.useMemo(() => new THREE.Object3D(), []);

  // Instance colours never change, so they are written once rather than per
  // frame alongside the matrices.
  React.useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    nodes.forEach((node, index) => {
      mesh.setColorAt(index, node.voice === 'customer' ? GOLD : VIOLET);
    });

    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [nodes]);

  useFrame(({ clock }) => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const time = reducedMotion ? 0 : clock.getElapsedTime();

    nodes.forEach((node, index) => {
      const breathe = 1 + Math.sin(time * 0.9 + node.phase) * 0.14;
      dummy.position.copy(node.position);
      dummy.position.y += Math.sin(time * 0.5 + node.phase) * 0.08;
      dummy.scale.setScalar(node.scale * breathe);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
    });

    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, nodes.length]}>
      <sphereGeometry args={[1, 20, 20]} />
      {/*
        White base so the per-instance colour is the colour actually seen.

        Additive blending reads as a glow on the plum ground and is what gives
        the nodes presence without a post-processing pass — but it composites
        toward white on the paper surface, so light mode uses normal blending.
      */}
      <meshBasicMaterial
        color="#ffffff"
        transparent
        opacity={1}
        blending={dark ? THREE.AdditiveBlending : THREE.NormalBlending}
      />
    </instancedMesh>
  );
}

/**
 * Signal pulses travelling from each node toward the centre.
 *
 * Positions are written into a single instanced mesh each frame rather than
 * mounting a mesh per pulse, so the whole effect costs one draw call.
 */
function Pulses({
  nodes,
  reducedMotion,
  dark,
}: {
  nodes: NodeSpec[];
  reducedMotion: boolean;
  dark: boolean;
}) {
  const meshRef = React.useRef<THREE.InstancedMesh>(null);
  const dummy = React.useMemo(() => new THREE.Object3D(), []);
  const origin = React.useMemo(() => new THREE.Vector3(0, 0, 0), []);

  React.useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    nodes.forEach((node, index) => {
      mesh.setColorAt(index, node.voice === 'customer' ? GOLD : VIOLET);
    });

    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [nodes]);

  useFrame(({ clock }) => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const time = clock.getElapsedTime();

    nodes.forEach((node, index) => {
      // Each pulse runs 0 → 1 along its edge on its own offset cycle.
      // Frozen mid-flight under reduced motion, so the composition still reads.
      const progress = reducedMotion
        ? (index / nodes.length + 0.3) % 1
        : (time * 0.32 + index / nodes.length) % 1;
      const eased = progress * progress * (3 - 2 * progress);

      dummy.position.lerpVectors(node.position, origin, eased);

      // Fade in at the start and out at the end so pulses do not pop.
      const fade = Math.sin(progress * Math.PI);
      dummy.scale.setScalar(0.06 * fade);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
    });

    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, nodes.length]}>
      <sphereGeometry args={[1, 12, 12]} />
      <meshBasicMaterial
        color="#ffffff"
        transparent
        opacity={1}
        blending={dark ? THREE.AdditiveBlending : THREE.NormalBlending}
      />
    </instancedMesh>
  );
}

/** The dashboard at the centre, with a slow halo. */
function Core({ reducedMotion }: { reducedMotion: boolean }) {
  const haloRef = React.useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (!haloRef.current || reducedMotion) return;
    const scale = 1 + Math.sin(clock.getElapsedTime() * 0.8) * 0.08;
    haloRef.current.scale.setScalar(scale);
  });

  return (
    <group>
      <mesh>
        <icosahedronGeometry args={[0.26, 1]} />
        <meshBasicMaterial color={VIOLET} transparent opacity={0.55} />
      </mesh>
      {/* Gold halo: the customer's voice arriving at the developer's inbox. */}
      <mesh ref={haloRef}>
        <icosahedronGeometry args={[0.6, 1]} />
        <meshBasicMaterial color={GOLD} transparent opacity={0.32} wireframe />
      </mesh>
    </group>
  );
}

/**
 * Parallax driven by pointer position.
 *
 * Applied to the whole group rather than the camera, so it composes with the
 * page's own scroll transforms without fighting them.
 */
function Scene({ reducedMotion, dark }: { reducedMotion: boolean; dark: boolean }) {
  const groupRef = React.useRef<THREE.Group>(null);
  const nodes = useNodes();
  const { viewport } = useThree();

  useFrame(({ pointer, clock }) => {
    const group = groupRef.current;
    if (!group) return;

    if (reducedMotion) {
      group.rotation.set(0, 0, 0);
      return;
    }

    const targetY = pointer.x * 0.18 + Math.sin(clock.getElapsedTime() * 0.15) * 0.06;
    const targetX = -pointer.y * 0.12;

    // Ease toward the target so the motion trails the cursor rather than
    // snapping to it.
    group.rotation.y += (targetY - group.rotation.y) * 0.04;
    group.rotation.x += (targetX - group.rotation.x) * 0.04;
  });

  // Shrink the whole scene on narrow viewports so it stays inside the frame.
  const scale = Math.min(1, viewport.width / 9.5);

  return (
    <group ref={groupRef} scale={scale}>
      <Edges nodes={nodes} dark={dark} />
      <Nodes nodes={nodes} reducedMotion={reducedMotion} dark={dark} />
      <Pulses nodes={nodes} reducedMotion={reducedMotion} dark={dark} />
      <Core reducedMotion={reducedMotion} />
    </group>
  );
}

export function FeedbackNetwork({ className }: { className?: string }) {
  // Read from the media query directly rather than mirroring it into state:
  // the very first frame is the one that has to be right.
  const reducedMotion = usePrefersReducedMotion();
  const { resolved } = useTheme();
  const dark = resolved === 'dark';

  return (
    <div className={className} aria-hidden>
      <Canvas
        camera={{ position: [0, 0, 9], fov: 45 }}
        // Capped so the scene does not render at 3x on high-density displays
        // for no visible benefit.
        dpr={[1, 1.75]}
        gl={{ antialias: true, alpha: true, powerPreference: 'low-power' }}
        // When motion is off, nothing changes between frames, so the render
        // loop is stopped entirely rather than spinning at 60fps.
        frameloop={reducedMotion ? 'demand' : 'always'}
      >
        <Scene reducedMotion={reducedMotion} dark={dark} />
      </Canvas>
    </div>
  );
}

export default FeedbackNetwork;
