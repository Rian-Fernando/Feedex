'use client';

import * as React from 'react';

import { cn } from '@/lib/cn';

/**
 * Form field primitives.
 *
 * `Field` owns the accessibility wiring — it generates an id, links the label,
 * the description, and the error message via `aria-describedby`, and sets
 * `aria-invalid` — so no call site has to remember to do it.
 */

interface FieldContextValue {
  id: string;
  descriptionId: string;
  errorId: string;
  hasError: boolean;
}

const FieldContext = React.createContext<FieldContextValue | null>(null);

function useField(): FieldContextValue {
  const context = React.useContext(FieldContext);
  if (!context) throw new Error('Field subcomponents must be used inside <Field>.');
  return context;
}

export interface FieldProps extends React.HTMLAttributes<HTMLDivElement> {
  error?: string | string[];
}

export function Field({ className, error, children, ...props }: FieldProps) {
  const generatedId = React.useId();
  const message = Array.isArray(error) ? error[0] : error;

  const value = React.useMemo<FieldContextValue>(
    () => ({
      id: generatedId,
      descriptionId: `${generatedId}-description`,
      errorId: `${generatedId}-error`,
      hasError: Boolean(message),
    }),
    [generatedId, message],
  );

  return (
    <FieldContext.Provider value={value}>
      <div className={cn('flex flex-col gap-1.5', className)} {...props}>
        {children}
        {message ? (
          <p id={value.errorId} role="alert" className="text-xs text-danger-500">
            {message}
          </p>
        ) : null}
      </div>
    </FieldContext.Provider>
  );
}

export function FieldLabel({
  className,
  children,
  optional,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement> & { optional?: boolean }) {
  const { id } = useField();

  return (
    <label
      htmlFor={id}
      className={cn('flex items-center gap-1.5 text-sm font-medium text-fg', className)}
      {...props}
    >
      {children}
      {optional ? <span className="text-xs font-normal text-fg-subtle">Optional</span> : null}
    </label>
  );
}

export function FieldDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  const { descriptionId } = useField();
  return <p id={descriptionId} className={cn('text-xs text-fg-subtle', className)} {...props} />;
}

const CONTROL_CLASSES = [
  'w-full rounded-lg border bg-surface-raised px-3 text-sm text-fg',
  'placeholder:text-fg-subtle',
  'transition-[border-color,box-shadow] duration-150',
  'hover:border-line-strong',
  'focus:outline-none focus-visible:outline-none',
  'focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20',
  'disabled:cursor-not-allowed disabled:opacity-60',
  'aria-[invalid=true]:border-danger-500 aria-[invalid=true]:focus:ring-danger-500/20',
].join(' ');

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(function Input({ className, ...props }, ref) {
  const field = React.useContext(FieldContext);

  return (
    <input
      ref={ref}
      id={field?.id}
      aria-invalid={field?.hasError || undefined}
      aria-describedby={
        field ? `${field.descriptionId} ${field.hasError ? field.errorId : ''}`.trim() : undefined
      }
      className={cn(CONTROL_CLASSES, 'h-9.5', className)}
      {...props}
    />
  );
});

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...props }, ref) {
  const field = React.useContext(FieldContext);

  return (
    <textarea
      ref={ref}
      id={field?.id}
      aria-invalid={field?.hasError || undefined}
      aria-describedby={
        field ? `${field.descriptionId} ${field.hasError ? field.errorId : ''}`.trim() : undefined
      }
      className={cn(CONTROL_CLASSES, 'min-h-24 resize-y py-2.5 leading-relaxed', className)}
      {...props}
    />
  );
});

/** Native select, styled to match. Used where a Radix Select would be overkill. */
export const NativeSelect = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(function NativeSelect({ className, children, ...props }, ref) {
  const field = React.useContext(FieldContext);

  return (
    <div className="relative">
      <select
        ref={ref}
        id={field?.id}
        aria-invalid={field?.hasError || undefined}
        className={cn(CONTROL_CLASSES, 'h-9.5 cursor-pointer appearance-none pr-9', className)}
        {...props}
      >
        {children}
      </select>
      <svg
        aria-hidden
        viewBox="0 0 12 12"
        className="pointer-events-none absolute top-1/2 right-3 size-3 -translate-y-1/2 text-fg-subtle"
      >
        <path
          d="M2.5 4.5 6 8l3.5-3.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
});
