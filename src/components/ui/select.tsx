'use client';

import * as React from 'react';
import { Select as RadixSelect } from 'radix-ui';
import { Check, ChevronDown } from 'lucide-react';

import { cn } from '@/lib/cn';

/**
 * Accessible select built on Radix.
 *
 * Preferred over the native control wherever options need richer content (a
 * colour dot, a description) or where the trigger must match the design system
 * exactly across platforms.
 */
export const Select = RadixSelect.Root;
export const SelectValue = RadixSelect.Value;

export function SelectTrigger({
  className,
  children,
  size = 'md',
  ...props
}: React.ComponentPropsWithoutRef<typeof RadixSelect.Trigger> & { size?: 'sm' | 'md' }) {
  return (
    <RadixSelect.Trigger
      className={cn(
        'inline-flex items-center justify-between gap-2 rounded-lg border border-line bg-surface-raised text-fg',
        'transition-[border-color,box-shadow] duration-150 hover:border-line-strong',
        'focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20 focus:outline-none',
        'disabled:cursor-not-allowed disabled:opacity-60 data-[placeholder]:text-fg-subtle',
        size === 'sm' ? 'h-8 px-2.5 text-[0.8125rem]' : 'h-9.5 px-3 text-sm',
        className,
      )}
      {...props}
    >
      {children}
      <RadixSelect.Icon asChild>
        <ChevronDown aria-hidden className="size-3.5 shrink-0 text-fg-subtle" />
      </RadixSelect.Icon>
    </RadixSelect.Trigger>
  );
}

export function SelectContent({
  className,
  children,
  position = 'popper',
  ...props
}: React.ComponentPropsWithoutRef<typeof RadixSelect.Content>) {
  return (
    <RadixSelect.Portal>
      <RadixSelect.Content
        position={position}
        sideOffset={6}
        className={cn(
          'z-50 overflow-hidden rounded-lg border border-line bg-surface-overlay shadow-overlay',
          'data-[state=closed]:animate-popover-out data-[state=open]:animate-popover-in',
          // Matches the trigger width so the list never appears narrower than
          // the control that opened it.
          'min-w-[var(--radix-select-trigger-width)]',
          'max-h-[min(24rem,var(--radix-select-content-available-height))]',
          className,
        )}
        {...props}
      >
        <RadixSelect.Viewport className="scrollbar-thin p-1">{children}</RadixSelect.Viewport>
      </RadixSelect.Content>
    </RadixSelect.Portal>
  );
}

export function SelectItem({
  className,
  children,
  ...props
}: React.ComponentPropsWithoutRef<typeof RadixSelect.Item>) {
  return (
    <RadixSelect.Item
      className={cn(
        'relative flex cursor-pointer items-center gap-2 rounded-md py-1.5 pr-2 pl-7 text-sm text-fg-muted select-none',
        'transition-colors duration-100 outline-none',
        'data-[highlighted]:bg-surface-inset data-[highlighted]:text-fg',
        'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        className,
      )}
      {...props}
    >
      <RadixSelect.ItemIndicator className="absolute left-2 flex items-center">
        <Check aria-hidden className="size-3.5 text-accent-500" />
      </RadixSelect.ItemIndicator>
      <RadixSelect.ItemText>{children}</RadixSelect.ItemText>
    </RadixSelect.Item>
  );
}

export function SelectSeparator({ className }: { className?: string }) {
  return <RadixSelect.Separator className={cn('-mx-1 my-1 h-px bg-line-subtle', className)} />;
}
