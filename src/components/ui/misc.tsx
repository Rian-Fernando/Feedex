'use client';

import * as React from 'react';
import { Tabs as RadixTabs, Tooltip as RadixTooltip, Switch as RadixSwitch } from 'radix-ui';
import { Check, Copy } from 'lucide-react';

import { cn } from '@/lib/cn';

/* ---------------------------------- Tabs ---------------------------------- */

export const Tabs = RadixTabs.Root;

export function TabsList({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof RadixTabs.List>) {
  return (
    <RadixTabs.List
      className={cn('flex items-center gap-1 border-b border-line-subtle', className)}
      {...props}
    />
  );
}

export function TabsTrigger({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof RadixTabs.Trigger>) {
  return (
    <RadixTabs.Trigger
      className={cn(
        'relative -mb-px px-3 py-2 text-sm font-medium text-fg-muted transition-colors',
        'hover:text-fg',
        // The active underline is drawn on the element itself rather than an
        // animated indicator, so it cannot desynchronise from the selection.
        'border-b-2 border-transparent data-[state=active]:border-accent-500 data-[state=active]:text-fg',
        className,
      )}
      {...props}
    />
  );
}

export const TabsContent = RadixTabs.Content;

/* --------------------------------- Tooltip -------------------------------- */

export const TooltipProvider = RadixTooltip.Provider;
export const Tooltip = RadixTooltip.Root;
export const TooltipTrigger = RadixTooltip.Trigger;

export function TooltipContent({
  className,
  sideOffset = 6,
  ...props
}: React.ComponentPropsWithoutRef<typeof RadixTooltip.Content>) {
  return (
    <RadixTooltip.Portal>
      <RadixTooltip.Content
        sideOffset={sideOffset}
        className={cn(
          'z-50 rounded-md bg-plum-900 px-2 py-1 text-xs text-white shadow-lg dark:bg-plum-800',
          'data-[state=delayed-open]:animate-popover-in',
          className,
        )}
        {...props}
      />
    </RadixTooltip.Portal>
  );
}

/** Convenience wrapper for the common "icon button with a label" case. */
export function Hint({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

/* --------------------------------- Switch --------------------------------- */

export function Switch({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof RadixSwitch.Root>) {
  return (
    <RadixSwitch.Root
      className={cn(
        'relative h-5 w-9 shrink-0 rounded-full bg-plum-300 transition-colors dark:bg-plum-700',
        'data-[state=checked]:bg-accent-600',
        'disabled:cursor-not-allowed disabled:opacity-60',
        className,
      )}
      {...props}
    >
      <RadixSwitch.Thumb
        className={cn(
          'block size-4 translate-x-0.5 rounded-full bg-white shadow-sm',
          'transition-transform duration-200 data-[state=checked]:translate-x-[1.125rem]',
        )}
      />
    </RadixSwitch.Root>
  );
}

/* ------------------------------- Copy button ------------------------------ */

export interface CopyButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
  /** Accessible label; defaults to a generic "Copy". */
  label?: string;
}

/**
 * Copies a value to the clipboard and confirms it inline for two seconds.
 *
 * Falls back to a hidden textarea + `execCommand` where the async Clipboard API
 * is unavailable (non-secure origins, older Safari), because API keys are the
 * main thing being copied and a silent failure there is a dead end.
 */
export function CopyButton({ value, label = 'Copy', className, ...props }: CopyButtonProps) {
  const [copied, setCopied] = React.useState(false);
  const timeout = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  React.useEffect(() => () => clearTimeout(timeout.current), []);

  async function copy() {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        const area = document.createElement('textarea');
        area.value = value;
        area.setAttribute('readonly', '');
        area.style.position = 'fixed';
        area.style.opacity = '0';
        document.body.appendChild(area);
        area.select();
        document.execCommand('copy');
        document.body.removeChild(area);
      }
      setCopied(true);
      clearTimeout(timeout.current);
      timeout.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={copied ? 'Copied' : label}
      className={cn(
        'inline-flex size-8 items-center justify-center text-fg-subtle hover:bg-surface-inset hover:text-fg',
        'rounded-md transition-colors',
        className,
      )}
      {...props}
    >
      {copied ? (
        <Check aria-hidden className="size-3.5 text-success-500" />
      ) : (
        <Copy aria-hidden className="size-3.5" />
      )}
      {/* Announced on change so a screen reader confirms the copy happened. */}
      <span aria-live="polite" className="sr-only">
        {copied ? 'Copied to clipboard' : ''}
      </span>
    </button>
  );
}

/* -------------------------------- Skeleton -------------------------------- */

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div aria-hidden className={cn('skeleton rounded-md', className)} {...props} />;
}

/* ------------------------------- Empty state ------------------------------ */

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 px-6 py-14 text-center',
        className,
      )}
    >
      {icon ? (
        <div className="flex size-11 items-center justify-center rounded-xl bg-surface-inset text-fg-subtle">
          {icon}
        </div>
      ) : null}
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium text-fg">{title}</p>
        {description ? (
          <p className="mx-auto max-w-sm text-sm leading-relaxed text-fg-muted">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

/* -------------------------------- Separator ------------------------------- */

export function Separator({
  className,
  orientation = 'horizontal',
}: {
  className?: string;
  orientation?: 'horizontal' | 'vertical';
}) {
  return (
    <div
      role="separator"
      aria-orientation={orientation}
      className={cn(
        'shrink-0 bg-line-subtle',
        orientation === 'horizontal' ? 'h-px w-full' : 'h-full w-px',
        className,
      )}
    />
  );
}
