'use client';

import * as React from 'react';
import { Slot } from 'radix-ui';
import { Loader2 } from 'lucide-react';

import { cn } from '@/lib/cn';

/**
 * The one button in the system.
 *
 * Variants are exhaustive on purpose — a surface that needs a button style not
 * listed here should get a new variant rather than inline classes, so the set
 * of possible buttons stays enumerable.
 */
export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger' | 'link';

export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon' | 'icon-sm';

/**
 * Brand violet is a light tint, so a filled violet surface takes plum text
 * rather than white — that pairing is both on-brand and the higher-contrast of
 * the two. Danger stays a darker red and keeps white text.
 */
const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-accent-500 text-plum-900 shadow-ambient hover:bg-accent-400 active:bg-accent-600 disabled:bg-accent-500/50',
  secondary:
    'bg-surface-raised text-fg border border-line shadow-ambient hover:bg-surface-inset hover:border-line-strong active:bg-surface-sunken',
  ghost: 'text-fg-muted hover:bg-surface-inset hover:text-fg active:bg-surface-sunken',
  outline:
    'border border-line-strong text-fg hover:bg-surface-inset hover:border-accent-500/50 active:bg-surface-sunken',
  danger:
    'bg-danger-600 text-white shadow-ambient hover:bg-danger-500 active:bg-danger-600 disabled:bg-danger-600/50',
  link: 'text-accent-500 underline-offset-4 hover:underline hover:text-accent-400 p-0 h-auto',
};

const SIZES: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-[0.8125rem] gap-1.5 rounded-md',
  md: 'h-9.5 px-4 text-sm gap-2 rounded-lg',
  lg: 'h-11 px-6 text-[0.9375rem] gap-2 rounded-lg',
  icon: 'size-9.5 rounded-lg',
  'icon-sm': 'size-8 rounded-md',
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Renders the child element instead of a `<button>`, keeping the styling. */
  asChild?: boolean;
  /** Shows a spinner and blocks interaction without changing the layout width. */
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    className,
    variant = 'primary',
    size = 'md',
    asChild = false,
    loading = false,
    children,
    disabled,
    ...props
  },
  ref,
) {
  const Component = asChild ? Slot.Root : 'button';

  return (
    <Component
      ref={ref}
      // `aria-busy` is what assistive tech announces; the spinner is decorative.
      aria-busy={loading || undefined}
      disabled={Component === 'button' ? disabled || loading : undefined}
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center font-medium whitespace-nowrap',
        'transition-[background-color,border-color,color,box-shadow,transform] duration-150',
        'disabled:pointer-events-none disabled:opacity-60',
        'active:translate-y-px',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    >
      {loading ? (
        <>
          {/* Absolute so the button keeps its resting width and the row below
              it does not reflow when a submit starts. */}
          <Loader2
            aria-hidden
            className="absolute top-1/2 left-1/2 size-4 -translate-x-1/2 -translate-y-1/2 animate-spin"
          />
          <span className="sr-only">Loading</span>
          <span className="inline-flex items-center gap-2 opacity-0" aria-hidden>
            {children}
          </span>
        </>
      ) : (
        children
      )}
    </Component>
  );
});
