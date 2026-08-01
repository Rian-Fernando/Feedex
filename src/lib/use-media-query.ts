'use client';

import * as React from 'react';

/**
 * Subscribes to a CSS media query.
 *
 * Built on `useSyncExternalStore` rather than `useEffect` + `setState`. A media
 * query is external state that React does not own, and reading it in an effect
 * means rendering once with the wrong value and then immediately re-rendering —
 * a visible flash for something like reduced-motion, where the first frame is
 * exactly the one that matters.
 *
 * `getServerSnapshot` returns `false` so server output matches the client's
 * first paint for a query that is unset by default.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = React.useCallback(
    (onChange: () => void) => {
      const media = window.matchMedia(query);
      media.addEventListener('change', onChange);
      return () => media.removeEventListener('change', onChange);
    },
    [query],
  );

  return React.useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
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
