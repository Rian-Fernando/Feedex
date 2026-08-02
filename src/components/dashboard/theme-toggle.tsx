'use client';

import { Moon, Sun } from 'lucide-react';

import { useTheme } from '@/components/theme-provider';

/**
 * One-click theme switch.
 *
 * A plain toggle rather than a light/dark/system menu: two states, one tap, no
 * decision to make. The three-way preference still exists in Settings for
 * anyone who wants to follow the OS — this is the fast path, and it flips
 * against whatever is currently *resolved*, so it does the obvious thing even
 * when the stored preference is "system".
 *
 * Lives only in the application chrome. The marketing site is dark by design.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { resolved, setTheme } = useTheme();
  const next = resolved === 'dark' ? 'light' : 'dark';

  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      // Announced as a switch so assistive tech reports the current state
      // rather than just the action.
      role="switch"
      aria-checked={resolved === 'dark'}
      aria-label={`Switch to ${next} theme`}
      title={`Switch to ${next} theme`}
      className={
        'relative inline-flex size-9 items-center justify-center rounded-lg text-fg-muted transition-colors hover:bg-surface-inset hover:text-fg ' +
        (className ?? '')
      }
    >
      {/*
        Both icons are always mounted and cross-faded, so the swap is a
        transition rather than a pop, and the button never changes size.
      */}
      <Sun
        aria-hidden
        className={`absolute size-4 transition-all duration-200 ${
          resolved === 'dark' ? 'scale-75 opacity-0' : 'scale-100 opacity-100'
        }`}
      />
      <Moon
        aria-hidden
        className={`absolute size-4 transition-all duration-200 ${
          resolved === 'dark' ? 'scale-100 opacity-100' : 'scale-75 opacity-0'
        }`}
      />
    </button>
  );
}
