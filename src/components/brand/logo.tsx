import * as React from 'react';

import { cn } from '@/lib/cn';

/**
 * The Feedex mark — "The Conversation Loop".
 *
 * A stadium oval split down the centre into two fused speech bubbles, with a
 * chat tail at each bottom corner and two arrows circulating inside: the top
 * one travels out, the bottom one returns. Gold is always the left half (the
 * customer's voice), violet always the right (the developer's response).
 *
 * Path data is transcribed verbatim from the brand handoff SVGs — per the
 * handoff, the geometry is the source of truth and must not be redrawn by eye.
 *
 * The arrows are knocked out through a mask rather than painted in the ground
 * colour, which is what lets the mark sit on any surface. That mask is the one
 * implementation detail worth guarding: filling the arrows plum instead would
 * break the logo everywhere except on plum.
 */

/** Shared viewBox for every variant. Aspect ratio 1.515:1 — never distort. */
const VIEW_BOX = '0 0 200 132';

/**
 * Masks are document-scoped, so every rendered mark needs its own id. `useId`
 * guarantees uniqueness even when several marks appear on one page, which the
 * handoff calls out explicitly.
 */
function useMaskId(): string {
  return `fx-mask-${React.useId().replace(/:/g, '')}`;
}

/** The knocked-out arrows. Identical across all variants. */
function ArrowMask({ id, animated = false }: { id: string; animated?: boolean }) {
  return (
    <mask id={id}>
      <rect width="200" height="132" fill="#fff" />
      <g
        fill="none"
        stroke="#000"
        strokeWidth="12"
        strokeLinecap="round"
        strokeLinejoin="round"
        // The only sanctioned logo animation: the arrows travel their own paths.
        className={animated ? 'motion-safe:animate-loop-arrows' : undefined}
        style={animated ? { strokeDasharray: '112 14' } : undefined}
      >
        <path d="M46 40 H152" />
        <path d="M130 27 L152 40 L130 53" />
        <path d="M154 70 H48" />
        <path d="M70 57 L48 70 L70 83" />
      </g>
    </mask>
  );
}

/** Oval halves and tails, taking their fills from props. */
function Bubble({ left, right }: { left: string; right: string }) {
  return (
    <>
      <path d="M100 12 H53 A43 43 0 0 0 53 98 H100 Z" fill={left} />
      <polygon points="62,90 36,120 84,99" fill={left} />
      <path d="M100 12 H147 A43 43 0 0 1 147 98 H100 Z" fill={right} />
      <polygon points="138,90 164,120 116,99" fill={right} />
    </>
  );
}

export type MarkVariant = 'duotone' | 'onlight' | 'mono';

export interface LogoMarkProps extends Omit<React.SVGProps<SVGSVGElement>, 'viewBox'> {
  /**
   * `duotone` (gold + violet) works on any background and is the default.
   * `onlight` swaps the gold half for plum, for paper surfaces where gold
   * washes out. `mono` inherits `currentColor`.
   */
  variant?: MarkVariant;
  /** Animates the arrows along their paths. Respects reduced-motion. */
  animated?: boolean;
  /**
   * When the mark sits beside a visible "Feedex" wordmark, pass `false` so
   * assistive tech does not announce the name twice.
   */
  labelled?: boolean;
}

export function LogoMark({
  variant = 'duotone',
  animated = false,
  labelled = true,
  className,
  ...props
}: LogoMarkProps) {
  const maskId = useMaskId();

  const fills: Record<MarkVariant, { left: string; right: string }> = {
    duotone: { left: '#F7B83D', right: '#B58BF9' },
    onlight: { left: '#17101F', right: '#B58BF9' },
    mono: { left: 'currentColor', right: 'currentColor' },
  };

  const { left, right } = fills[variant];

  return (
    <svg
      viewBox={VIEW_BOX}
      // Height-driven so the 1.515:1 ratio is preserved by `width: auto`.
      className={cn('h-7 w-auto', className)}
      role={labelled ? 'img' : undefined}
      aria-label={labelled ? 'Feedex' : undefined}
      aria-hidden={labelled ? undefined : true}
      {...props}
    >
      <defs>
        <ArrowMask id={maskId} animated={animated} />
      </defs>
      <g mask={`url(#${maskId})`}>
        <Bubble left={left} right={right} />
      </g>
    </svg>
  );
}

export interface LogoProps {
  /**
   * Sets the lockup's `font-size`, which every other dimension derives from.
   * Use a Tailwind text utility to scale it, including responsively:
   * `className="text-[26px] sm:text-[30px]"`.
   */
  className?: string;
  /** Hides the wordmark, leaving the mark alone. */
  showWordmark?: boolean;
  variant?: MarkVariant;
  animated?: boolean;
}

/**
 * Horizontal lockup: mark on the left, wordmark on the right.
 *
 * The handoff fixes the proportions against mark height — wordmark at 0.82×,
 * gap at 0.25× mark *width* (so 0.379× mark height) — so everything is
 * expressed in `em` and driven by a single `font-size`. That keeps the ratios
 * exact at any scale and makes responsive sizing a class change rather than a
 * prop threaded through every call site.
 */
export function Logo({
  className,
  showWordmark = true,
  variant = 'duotone',
  animated = false,
}: LogoProps) {
  return (
    <span
      className={cn('inline-flex shrink-0 items-center text-[26px] sm:text-[30px]', className)}
      style={{ gap: showWordmark ? '0.379em' : undefined }}
    >
      <LogoMark
        variant={variant}
        animated={animated}
        labelled={!showWordmark}
        className="h-[1em] w-auto"
      />
      {showWordmark ? (
        <span
          // Never gold or violet: the wordmark takes the text colour.
          className="font-semibold text-fg"
          style={{
            fontSize: '0.82em',
            letterSpacing: '-0.03em',
            lineHeight: 1,
            // Optical centring — the mark's tails hang below its oval, so the
            // wordmark sits slightly high against the bounding box.
            transform: 'translateY(-0.073em)',
          }}
        >
          Feedex
        </span>
      ) : null}
    </span>
  );
}
