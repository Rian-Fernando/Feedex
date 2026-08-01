'use client';

import * as React from 'react';
import { Dialog as RadixDialog } from 'radix-ui';
import { X } from 'lucide-react';

import { cn } from '@/lib/cn';

/**
 * Modal dialog.
 *
 * Radix handles focus trapping, scroll locking, `aria-modal`, and Escape; this
 * wrapper supplies the styling and the close affordance so those behaviours are
 * never re-implemented per dialog.
 */
export const Dialog = RadixDialog.Root;
export const DialogTrigger = RadixDialog.Trigger;
export const DialogClose = RadixDialog.Close;

export function DialogContent({
  className,
  children,
  showClose = true,
  ...props
}: React.ComponentPropsWithoutRef<typeof RadixDialog.Content> & { showClose?: boolean }) {
  return (
    <RadixDialog.Portal>
      <RadixDialog.Overlay
        className={cn(
          'fixed inset-0 z-50 bg-plum-950/50 backdrop-blur-sm',
          'data-[state=closed]:animate-overlay-out data-[state=open]:animate-overlay-in',
        )}
      />
      <RadixDialog.Content
        className={cn(
          'fixed top-1/2 left-1/2 z-50 w-[calc(100vw-2rem)] max-w-lg border-line bg-surface-overlay shadow-overlay',
          '-translate-x-1/2 -translate-y-1/2 rounded-xl border',
          'max-h-[calc(100dvh-4rem)] scrollbar-thin overflow-y-auto',
          'data-[state=closed]:animate-dialog-out data-[state=open]:animate-dialog-in',
          className,
        )}
        {...props}
      >
        {children}
        {showClose ? (
          <RadixDialog.Close
            className={cn(
              'absolute top-4 right-4 text-fg-subtle hover:bg-surface-inset hover:text-fg',
              'inline-flex size-8 items-center justify-center rounded-md transition-colors',
            )}
          >
            <X aria-hidden className="size-4" />
            <span className="sr-only">Close</span>
          </RadixDialog.Close>
        ) : null}
      </RadixDialog.Content>
    </RadixDialog.Portal>
  );
}

export function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col gap-1.5 p-5 pr-12 pb-0', className)} {...props} />;
}

export function DialogTitle({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof RadixDialog.Title>) {
  return (
    <RadixDialog.Title className={cn('text-base font-semibold text-fg', className)} {...props} />
  );
}

export function DialogDescription({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof RadixDialog.Description>) {
  return (
    <RadixDialog.Description
      className={cn('text-sm leading-relaxed text-fg-muted', className)}
      {...props}
    />
  );
}

export function DialogBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-5', className)} {...props} />;
}

export function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'flex flex-col-reverse gap-2 border-t border-line-subtle px-5 py-4 sm:flex-row sm:justify-end',
        className,
      )}
      {...props}
    />
  );
}
