'use client';

import * as React from 'react';

import { usePrefersDark } from '@/lib/use-media-query';

export type Theme = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'feedex-theme';

interface ThemeContextValue {
  theme: Theme;
  resolved: 'light' | 'dark';
  setTheme: (theme: Theme) => void;
}

const ThemeContext = React.createContext<ThemeContextValue | null>(null);

/**
 * Reads the stored preference.
 *
 * Exposed through `useSyncExternalStore` below so the first client render sees
 * the same value the blocking script already applied, rather than rendering the
 * default and correcting it in an effect.
 */
function readStoredTheme(): Theme {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
  } catch {
    // Storage can be unavailable (private mode, blocked cookies).
  }
  return 'dark';
}

/** Notifies subscribers when this tab, or another one, changes the theme. */
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  // `storage` fires only in *other* tabs, which is exactly the cross-tab sync
  // case; same-tab changes are pushed through `emit`.
  window.addEventListener('storage', onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener('storage', onChange);
  };
}

/**
 * Theme controller.
 *
 * The class is applied by the inline script in the document head before first
 * paint (see `ThemeScript`), so this provider only mirrors what is already on
 * the element. Both the stored preference and the OS preference are read
 * through `useSyncExternalStore`, which keeps the first render correct instead
 * of correcting it afterwards.
 */
export function ThemeProvider({
  children,
  initial = 'dark',
}: {
  children: React.ReactNode;
  initial?: Theme;
}) {
  const theme = React.useSyncExternalStore(subscribe, readStoredTheme, () => initial);
  const prefersDark = usePrefersDark();
  const resolved: 'light' | 'dark' = theme === 'system' ? (prefersDark ? 'dark' : 'light') : theme;

  // Writing a class onto <html> is a side effect on an external system, which
  // is precisely what an effect is for.
  React.useEffect(() => {
    document.documentElement.classList.toggle('dark', resolved === 'dark');
    document.documentElement.style.colorScheme = resolved;
  }, [resolved]);

  const setTheme = React.useCallback((next: Theme) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Non-persistent is better than broken.
    }
    emit();
  }, []);

  const value = React.useMemo(() => ({ theme, resolved, setTheme }), [theme, resolved, setTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = React.useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within <ThemeProvider>.');
  return context;
}

/**
 * Blocking script that sets the theme class before the first paint.
 *
 * This must run synchronously in `<head>`; deferring it produces a flash of the
 * wrong theme on every navigation to a fresh document.
 */
export function ThemeScript({ defaultTheme = 'dark' }: { defaultTheme?: Theme }) {
  const script = `
(function () {
  try {
    var stored = localStorage.getItem('${STORAGE_KEY}') || '${defaultTheme}';
    var dark = stored === 'dark' || (stored === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', dark);
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
  } catch (e) {
    document.documentElement.classList.add('dark');
  }
})();`.trim();

  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
