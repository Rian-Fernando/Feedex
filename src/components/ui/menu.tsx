'use client';

import * as React from 'react';
import { DropdownMenu as RadixMenu } from 'radix-ui';
import { Check } from 'lucide-react';

import { cn } from '@/lib/cn';

/** Dropdown menu, used for row actions and the account menu. */
export const Menu = RadixMenu.Root;
export const MenuTrigger = RadixMenu.Trigger;

const PANEL_CLASSES = [
  'z-50 min-w-44 overflow-hidden rounded-lg border border-line bg-surface-overlay p-1 shadow-overlay',
  'data-[state=open]:animate-popover-in data-[state=closed]:animate-popover-out',
].join(' ');

const ITEM_CLASSES = [
  'relative flex cursor-pointer select-none items-center gap-2 rounded-md px-2 py-1.5 text-sm text-fg-muted outline-none',
  'transition-colors duration-100',
  'data-[highlighted]:bg-surface-inset data-[highlighted]:text-fg',
  'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
].join(' ');

export function MenuContent({
  className,
  sideOffset = 6,
  align = 'end',
  ...props
}: React.ComponentPropsWithoutRef<typeof RadixMenu.Content>) {
  return (
    <RadixMenu.Portal>
      <RadixMenu.Content
        sideOffset={sideOffset}
        align={align}
        className={cn(PANEL_CLASSES, className)}
        {...props}
      />
    </RadixMenu.Portal>
  );
}

export function MenuItem({
  className,
  destructive = false,
  ...props
}: React.ComponentPropsWithoutRef<typeof RadixMenu.Item> & { destructive?: boolean }) {
  return (
    <RadixMenu.Item
      className={cn(
        ITEM_CLASSES,
        destructive &&
          'text-danger-500 data-[highlighted]:bg-danger-500/10 data-[highlighted]:text-danger-500',
        className,
      )}
      {...props}
    />
  );
}

export function MenuCheckboxItem({
  className,
  children,
  ...props
}: React.ComponentPropsWithoutRef<typeof RadixMenu.CheckboxItem>) {
  return (
    <RadixMenu.CheckboxItem className={cn(ITEM_CLASSES, 'pl-7', className)} {...props}>
      <RadixMenu.ItemIndicator className="absolute left-2 flex items-center">
        <Check aria-hidden className="size-3.5" />
      </RadixMenu.ItemIndicator>
      {children}
    </RadixMenu.CheckboxItem>
  );
}

export function MenuLabel({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof RadixMenu.Label>) {
  return (
    <RadixMenu.Label
      className={cn('px-2 py-1.5 text-2xs font-medium text-fg-subtle uppercase', className)}
      {...props}
    />
  );
}

export function MenuSeparator({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof RadixMenu.Separator>) {
  return (
    <RadixMenu.Separator className={cn('-mx-1 my-1 h-px bg-line-subtle', className)} {...props} />
  );
}
