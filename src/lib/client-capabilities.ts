'use client';

import * as React from 'react';

/**
 * Browser capabilities, read as external state.
 *
 * All of these are properties of the environment rather than of the
 * application, so they are subscribed to with `useSyncExternalStore` instead of
 * mirrored into state inside an effect. The practical difference: the first
 * client render already has the right answer, rather than rendering a default
 * and correcting it a frame later.
 *
 * Every server snapshot is the conservative value, so nothing that depends on a
 * GPU or a media query is ever server-rendered as present.
 */

/* ------------------------------ media queries ----------------------------- */

function subscribeToMedia(query: string) {
  return (onChange: () => void) => {
    const media = window.matchMedia(query);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  };
}

export function useMediaQuery(query: string, serverValue = false): boolean {
  const subscribe = React.useMemo(() => subscribeToMedia(query), [query]);

  return React.useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => serverValue,
  );
}

/** Whether the visitor has asked the platform to reduce motion. */
export function usePrefersReducedMotion(): boolean {
  return useMediaQuery('(prefers-reduced-motion: reduce)');
}

/** Whether the platform colour scheme is dark. */
export function usePrefersDark(): boolean {
  return useMediaQuery('(prefers-color-scheme: dark)');
}

/* -------------------------------- WebGL ---------------------------------- */

/**
 * Support is fixed for the life of the page, so it is probed once and cached.
 * Creating a throwaway context is not free, and the answer cannot change.
 */
let webglSupport: boolean | null = null;

function detectWebGL(): boolean {
  if (typeof window === 'undefined') return false;

  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

function getWebGL(): boolean {
  webglSupport ??= detectWebGL();
  return webglSupport;
}

/** Capability never changes, so there is nothing to subscribe to. */
const noSubscription = () => () => {};

export function useWebGLSupport(): boolean {
  return React.useSyncExternalStore(noSubscription, getWebGL, () => false);
}

/* ------------------------------ render budget ----------------------------- */

/**
 * A coarse quality tier.
 *
 * Touch devices, narrow viewports, and low core counts all correlate with a
 * GPU that will not enjoy antialiasing plus a postprocessing pass at full
 * device pixel ratio.
 */
export function useRenderQuality(): 'high' | 'low' {
  const coarse = useMediaQuery('(pointer: coarse)');
  const narrow = useMediaQuery('(max-width: 767px)');

  const weak = React.useSyncExternalStore(
    noSubscription,
    () => (navigator.hardwareConcurrency ?? 8) <= 4,
    () => false,
  );

  return coarse || narrow || weak ? 'low' : 'high';
}

/* ----------------------------- page visibility ---------------------------- */

function subscribeToVisibility(onChange: () => void) {
  document.addEventListener('visibilitychange', onChange);
  return () => document.removeEventListener('visibilitychange', onChange);
}

/** False while the tab is hidden, so render loops can be stopped. */
export function usePageVisible(): boolean {
  return React.useSyncExternalStore(
    subscribeToVisibility,
    () => !document.hidden,
    () => true,
  );
}
