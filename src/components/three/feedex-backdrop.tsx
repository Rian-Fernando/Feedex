'use client';

import { useEffect, useRef } from 'react';

import {
  usePageVisible,
  usePrefersReducedMotion,
  useRenderQuality,
  useWebGLSupport,
} from '@/lib/client-capabilities';
import type { SceneHandle } from './feedex-scene';

/** Where the scene is held when motion is off — the triage beat. */
const STILL_FRAME = 0.7;

/**
 * Decorative WebGL backdrop for the landing page.
 *
 * Fixed behind the entire page and driven by the whole document's scroll
 * range, so the story runs from the first screen to the last rather than
 * finishing a third of the way down. The page's real content is
 * server-rendered HTML on top; if WebGL is unavailable the canvas never mounts
 * and the page simply reads as a quiet dark layout.
 *
 * The scene module is imported dynamically on mount rather than through
 * `next/dynamic`, because it is a plain function and not a component — three.js
 * and its postprocessing passes stay out of the initial bundle either way.
 */
export function FeedexBackdrop() {
  // Environment, read as external state so the first client render is already
  // correct rather than defaulting and then correcting a frame later.
  const webgl = useWebGLSupport();
  const reduced = usePrefersReducedMotion();
  const quality = useRenderQuality();
  const visible = usePageVisible();

  const animate = !reduced;

  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<SceneHandle | null>(null);
  const progressRef = useRef(reduced ? STILL_FRAME : 0);
  const pointerRef = useRef({ x: 0, y: 0 });

  // Build and tear down the scene.
  useEffect(() => {
    if (!webgl) return;

    const mount = mountRef.current;
    if (!mount) return;

    let cancelled = false;

    void import('./feedex-scene').then(({ createScene }) => {
      if (cancelled || !mountRef.current) return;
      sceneRef.current = createScene(mountRef.current, progressRef, pointerRef, {
        animate,
        quality,
      });
    });

    return () => {
      cancelled = true;
      sceneRef.current?.dispose();
      sceneRef.current = null;
    };
  }, [webgl, animate, quality]);

  // Stop the loop while the tab is hidden.
  useEffect(() => {
    sceneRef.current?.setActive(visible);
  }, [visible]);

  /**
   * Scroll → story progress across the entire document.
   *
   * Measured against the full scrollable height rather than one section, so
   * the last beat lands on the last screen of the page.
   */
  useEffect(() => {
    if (!webgl) return;

    if (reduced) {
      progressRef.current = STILL_FRAME;
      return;
    }

    let frame = 0;

    const update = () => {
      frame = 0;
      const doc = document.documentElement;
      const total = doc.scrollHeight - window.innerHeight;
      progressRef.current = total <= 0 ? 0 : Math.min(Math.max(window.scrollY / total, 0), 1);
    };

    const onScroll = () => {
      // Coalesced to one read per frame: scroll fires far more often than the
      // display refreshes, and reading layout on every event is wasteful.
      if (!frame) frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });

    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [webgl, reduced]);

  // Subtle parallax so the scene reads as a physical space.
  useEffect(() => {
    if (!webgl || !animate || quality === 'low') return;

    const onMove = (event: PointerEvent) => {
      pointerRef.current = {
        x: (event.clientX / window.innerWidth - 0.5) * 2,
        y: -(event.clientY / window.innerHeight - 0.5) * 2,
      };
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, [webgl, animate, quality]);

  return (
    // The ground is painted here rather than on the page wrapper, so it exists
    // whether or not the canvas ever mounts.
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 bg-plum-900">
      {webgl ? <div ref={mountRef} className="absolute inset-0" /> : null}

      {/*
        One constant scrim rather than a ramp. The story now runs the whole
        page, so the scene has to stay visible throughout while every band of
        copy stays comfortably readable over it.
      */}
      <div className="absolute inset-0 bg-gradient-to-b from-plum-900/70 via-plum-900/60 to-plum-900/80" />
    </div>
  );
}
