'use client';

import * as React from 'react';

/**
 * A single shared scroll position, read without re-rendering.
 *
 * The hero's WebGL scene needs the scroll offset every frame. Putting that in
 * React state would re-render the tree sixty times a second for a value that
 * only ever feeds an animation, so it lives in a module-level object instead:
 * one passive listener writes it, `useFrame` reads it, and React is not
 * involved at all.
 *
 * Components that genuinely need to re-render on scroll should use Motion's
 * `useScroll` rather than this.
 */
export const scrollState = {
  /** Pixels scrolled from the top of the document. */
  y: 0,
  /** 0 → 1 across the first `NARRATIVE_HEIGHT` of scrolling. */
  narrative: 0,
  /** Viewport height, cached so the frame loop never reads layout. */
  viewportHeight: 0,
};

/**
 * How far the hero scene stays pinned, in viewport heights.
 *
 * Two screens is enough to tell the story — projects converging into one
 * dashboard — without turning the top of the page into a scroll jail.
 */
export const NARRATIVE_VIEWPORTS = 2;

let listeners = 0;
let frame = 0;

function measure(): void {
  scrollState.y = window.scrollY;
  scrollState.viewportHeight = window.innerHeight;

  const span = window.innerHeight * NARRATIVE_VIEWPORTS;
  scrollState.narrative = span > 0 ? Math.min(1, Math.max(0, window.scrollY / span)) : 0;

  frame = 0;
}

function onScroll(): void {
  // Coalesced to one read per frame: scroll fires far more often than the
  // display refreshes, and reading `scrollY` forces layout.
  if (frame) return;
  frame = window.requestAnimationFrame(measure);
}

/**
 * Keeps `scrollState` current for as long as any component is mounted.
 *
 * Reference-counted so several consumers share one listener.
 */
export function useScrollProgress(): void {
  React.useEffect(() => {
    listeners += 1;

    if (listeners === 1) {
      measure();
      window.addEventListener('scroll', onScroll, { passive: true });
      window.addEventListener('resize', onScroll, { passive: true });
    }

    return () => {
      listeners -= 1;
      if (listeners === 0) {
        window.removeEventListener('scroll', onScroll);
        window.removeEventListener('resize', onScroll);
        if (frame) window.cancelAnimationFrame(frame);
        frame = 0;
      }
    };
  }, []);
}

/** Smoothstep, for easing a raw 0→1 progress without a library. */
export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}
