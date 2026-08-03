'use client';

import * as React from 'react';

/**
 * Two themes, not three.
 *
 * Feedex is a dark product — the marketing site is dark unconditionally and
 * the palette was designed there. "Match my system" sounds accommodating but
 * in practice it means a visitor whose laptop is in light mode gets the theme
 * nobody designed against, without ever asking for it. Dark is the default and
 * light is a deliberate choice.
 */
export type Theme = 'light' | 'dark';

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
    // Anything else — including the "system" this used to support — resolves to
    // dark rather than being honoured, so an old stored value does not keep a
    // browser on a setting the UI can no longer express.
    if (stored === 'light') return 'light';
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
  const resolved: 'light' | 'dark' = theme;

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
    // Only an explicit 'light' opts out; everything else, including the
    // retired 'system' value, is dark.
    var stored = localStorage.getItem('${STORAGE_KEY}') || '${defaultTheme}';
    var dark = stored !== 'light';
    document.documentElement.classList.toggle('dark', dark);
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
  } catch (e) {
    document.documentElement.classList.add('dark');
  }
})();`.trim();

  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
