import * as React from 'react';

import { cn } from '@/lib/cn';
import type { TaxonomyEntry } from '@/lib/taxonomy';

/**
 * Status and category chips.
 *
 * `tone` is the same vocabulary the taxonomy uses, so a badge can be rendered
 * straight from a taxonomy entry without a translation table at the call site.
 */
export type BadgeTone = TaxonomyEntry<string>['tone'];

const TONES: Record<BadgeTone, string> = {
  neutral: 'bg-plum-500/10 text-fg-muted ring-plum-500/20',
  info: 'bg-info-500/10 text-info-600 dark:text-info-400 ring-info-500/20',
  success: 'bg-success-500/10 text-success-600 dark:text-success-400 ring-success-500/20',
  warning: 'bg-warning-500/12 text-warning-600 dark:text-warning-400 ring-warning-500/25',
  danger: 'bg-danger-500/10 text-danger-600 dark:text-danger-400 ring-danger-500/20',
  accent: 'bg-accent-500/10 text-accent-600 dark:text-accent-400 ring-accent-500/20',
};

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  /** Adds a small filled dot in the current tone. */
  dot?: boolean;
  size?: 'sm' | 'md';
}

export function Badge({
  className,
  tone = 'neutral',
  dot = false,
  size = 'md',
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full font-medium whitespace-nowrap ring-1 ring-inset',
        size === 'sm' ? 'px-1.5 py-0.5 text-2xs' : 'px-2 py-0.5 text-xs',
        TONES[tone],
        className,
      )}
      {...props}
    >
      {dot ? <span aria-hidden className="size-1.5 rounded-full bg-current" /> : null}
      {children}
    </span>
  );
}
