'use client';

import * as React from 'react';
import { Check } from 'lucide-react';

import { cn } from '@/lib/cn';

/**
 * Accent colour picker.
 *
 * A bare `<input type="color">` stretches to its container and renders as a
 * wide slab of colour with a browser-drawn border — it reads as a broken
 * banner rather than a control, and it gives no sense of which colours belong
 * together. This offers the palette first, at the size the colour is actually
 * used (a dot in a list), and keeps the native picker as the escape hatch for
 * a brand colour that is not in the set.
 *
 * Controlled, with a hidden input so it still submits inside a plain form.
 */

/**
 * Preset accents. Violet and gold lead because they are the brand colours; the
 * rest are far enough apart to stay tellable at the size of a 10px dot when
 * several projects are listed together.
 */
export const COLOR_SWATCHES = [
  '#B58BF9',
  '#F7B83D',
  '#5EC8A0',
  '#E8833A',
  '#6BA8E5',
  '#E2637E',
  '#A78BFA',
] as const;

export interface ColorPickerProps {
  value: string;
  onChange: (value: string) => void;
  /** Submitted with the surrounding form when present. */
  name?: string;
  /** Labels the group for assistive technology. */
  label?: string;
  className?: string;
}

export function ColorPicker({ value, onChange, name, label, className }: ColorPickerProps) {
  const nativeInput = React.useRef<HTMLInputElement>(null);
  const normalised = value.toLowerCase();
  const isPreset = COLOR_SWATCHES.some((swatch) => swatch.toLowerCase() === normalised);

  return (
    <div className={cn('flex flex-col gap-2.5', className)}>
      {name ? <input type="hidden" name={name} value={value} /> : null}

      <div role="group" aria-label={label ?? 'Accent colour'} className="flex flex-wrap gap-2">
        {COLOR_SWATCHES.map((swatch) => {
          const active = swatch.toLowerCase() === normalised;

          return (
            <button
              key={swatch}
              type="button"
              onClick={() => onChange(swatch)}
              aria-label={`Use colour ${swatch}`}
              aria-pressed={active}
              className="flex size-7 items-center justify-center rounded-full transition-transform hover:scale-110 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none data-[active=true]:ring-2 data-[active=true]:ring-offset-2"
              data-active={active}
              style={
                {
                  backgroundColor: swatch,
                  '--tw-ring-color': swatch,
                  '--tw-ring-offset-color': 'var(--surface-overlay)',
                } as React.CSSProperties
              }
            >
              {active ? (
                <Check aria-hidden className="size-3.5 text-plum-900" strokeWidth={3} />
              ) : null}
            </button>
          );
        })}

        {/*
          The custom well doubles as the swatch for a colour outside the
          palette, so a project on a brand colour still shows its own colour
          here rather than an inert rainbow.
        */}
        <button
          type="button"
          onClick={() => nativeInput.current?.click()}
          aria-label="Choose a custom colour"
          aria-pressed={!isPreset}
          className="relative flex size-7 items-center justify-center rounded-full transition-transform hover:scale-110 data-[active=true]:ring-2 data-[active=true]:ring-offset-2"
          data-active={!isPreset}
          style={
            {
              background: isPreset
                ? 'conic-gradient(from 0deg, #E2637E, #F7B83D, #5EC8A0, #6BA8E5, #B58BF9, #E2637E)'
                : value,
              '--tw-ring-color': isPreset ? 'var(--accent-500)' : value,
              '--tw-ring-offset-color': 'var(--surface-overlay)',
            } as React.CSSProperties
          }
        >
          {!isPreset ? (
            <Check aria-hidden className="size-3.5 text-plum-900" strokeWidth={3} />
          ) : null}
        </button>
      </div>

      <div className="flex items-center gap-2">
        {/*
          Visually hidden rather than `display: none`: a hidden input cannot be
          opened by `.click()` in Safari, which would leave the custom well
          doing nothing on that browser.
        */}
        <input
          ref={nativeInput}
          type="color"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          tabIndex={-1}
          aria-hidden
          className="pointer-events-none absolute size-0 opacity-0"
        />
        <input
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-label="Accent colour hex value"
          maxLength={7}
          spellCheck={false}
          className="h-8 w-28 rounded-md border border-line bg-surface-inset px-2.5 font-mono text-xs text-fg transition-colors placeholder:text-fg-subtle focus-visible:border-accent-500 focus-visible:ring-2 focus-visible:ring-accent-500/25 focus-visible:outline-none"
        />
        <span className="text-xs text-fg-subtle">Or pick any hex colour.</span>
      </div>
    </div>
  );
}
