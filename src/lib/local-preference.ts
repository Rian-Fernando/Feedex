'use client';

import * as React from 'react';

/**
 * Small per-browser preferences: the collapsed rail, the board's hidden
 * columns.
 *
 * Read through `useSyncExternalStore` rather than loaded into state by an
 * effect. `localStorage` is external state React does not own, and the effect
 * version costs a second render on every mount and briefly shows the default —
 * a rail that expands and then collapses, or a column that appears and then
 * vanishes.
 *
 * These are deliberately not stored on the server. They are per-device working
 * preferences, not account settings; the same person at a laptop and a large
 * monitor wants different answers.
 */

const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  // `storage` fires only in other tabs, which is the cross-tab case; changes
  // in this tab are pushed through `emit`.
  window.addEventListener('storage', onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener('storage', onChange);
  };
}

function write(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Private mode or blocked storage. Not persisting beats not working.
  }
  emit();
}

/** A boolean preference, defaulting to false. */
export function useBooleanPreference(key: string): [boolean, (value: boolean) => void] {
  const value = React.useSyncExternalStore(
    subscribe,
    () => {
      try {
        return window.localStorage.getItem(key) === 'true';
      } catch {
        return false;
      }
    },
    () => false,
  );

  const set = React.useCallback((next: boolean) => write(key, String(next)), [key]);

  return [value, set];
}

const EMPTY: string[] = [];

/**
 * A set of strings, stored as JSON.
 *
 * The parsed array is memoised against its raw text because
 * `useSyncExternalStore` compares snapshots by identity — parsing on every read
 * would return a new array each time and loop forever.
 */
export function useStringSetPreference(key: string): [string[], (value: string) => void] {
  const cache = React.useRef<{ raw: string | null; parsed: string[] }>({
    raw: null,
    parsed: EMPTY,
  });

  const value = React.useSyncExternalStore(
    subscribe,
    () => {
      let raw: string | null = null;
      try {
        raw = window.localStorage.getItem(key);
      } catch {
        return EMPTY;
      }

      if (raw === cache.current.raw) return cache.current.parsed;

      let parsed: string[] = EMPTY;
      try {
        const decoded: unknown = raw ? JSON.parse(raw) : [];
        if (Array.isArray(decoded))
          parsed = decoded.filter((e): e is string => typeof e === 'string');
      } catch {
        parsed = EMPTY;
      }

      cache.current = { raw, parsed };
      return parsed;
    },
    () => EMPTY,
  );

  const toggle = React.useCallback(
    (entry: string) => {
      const next = value.includes(entry)
        ? value.filter((existing) => existing !== entry)
        : [...value, entry];
      write(key, JSON.stringify(next));
    },
    [key, value],
  );

  return [value, toggle];
}
