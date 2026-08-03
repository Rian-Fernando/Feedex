'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Field, FieldLabel, Input } from '@/components/ui/field';
import { loginAction, registerAction } from '@/server/actions/auth';
import { ProviderButtons } from './provider-buttons';
import type { ActionResult } from '@/lib/errors';

/**
 * Sign-in and registration forms.
 *
 * Both use `useActionState`, so the form posts and re-renders with server-side
 * validation results without any client-side duplication of the rules. The
 * navigation on success happens here rather than in the action, because the
 * action needs to return an error state for the failure path.
 */

function FormError({ message }: { message?: string }) {
  if (!message) return null;

  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-lg border border-danger-500/25 bg-danger-500/10 px-3 py-2.5 text-sm text-danger-500"
    >
      <AlertCircle aria-hidden className="mt-0.5 size-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

/** Preserves a `next` destination when moving between sign-in and sign-up. */
function withNext(path: string, next: string | null): string {
  return next?.startsWith('/') && !next.startsWith('//')
    ? `${path}?next=${encodeURIComponent(next)}`
    : path;
}

const INITIAL: ActionResult = { ok: false };

export function LoginForm({
  providers = [],
}: {
  providers?: Array<{ id: string; label: string }>;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next');
  // The OAuth callback redirects here with a readable reason on failure.
  const providerError = params.get('error');

  const [state, formAction, pending] = React.useActionState(loginAction, INITIAL);

  React.useEffect(() => {
    if (state.ok) {
      // `refresh()` re-runs the server components so the new session cookie is
      // picked up before the push lands on a protected route.
      router.refresh();
      router.push(next && next.startsWith('/') ? next : '/dashboard');
    }
  }, [state.ok, router, next]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-semibold tracking-tight text-fg">Welcome back</h1>
        <p className="text-sm text-fg-muted">Sign in to your Feedex workspace.</p>
      </div>

      {/* The OAuth callback redirects here with a readable reason on failure. */}
      <FormError message={providerError ?? undefined} />

      <ProviderButtons providers={providers} next={next ?? undefined} />

      <form action={formAction} className="flex flex-col gap-4">
        <FormError message={state.code !== 'validation_error' ? state.error : undefined} />

        <Field
          error={
            state.fieldErrors?.email ??
            (state.code === 'validation_error' ? state.error : undefined)
          }
        >
          <FieldLabel>Email</FieldLabel>
          <Input
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            required
            autoFocus
          />
        </Field>

        <Field error={state.fieldErrors?.password}>
          <FieldLabel>Password</FieldLabel>
          <Input
            name="password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••••"
            required
          />
        </Field>

        <Button type="submit" loading={pending} className="mt-1 w-full">
          Sign in
        </Button>
      </form>

      <p className="text-center text-sm text-fg-muted">
        Don&apos;t have an account?{' '}
        {/*
          Carries `next` across. Someone who followed an invitation and has no
          account yet passes through here, and dropping the parameter at this
          link is precisely how they end up in an empty workspace of their own
          wondering where the invitation went.
        */}
        <Link
          href={withNext('/register', next)}
          className="font-medium text-accent-500 hover:underline"
        >
          Create one
        </Link>
      </p>
    </div>
  );
}

export function RegisterForm({
  providers = [],
}: {
  providers?: Array<{ id: string; label: string }>;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [state, formAction, pending] = React.useActionState(registerAction, INITIAL);

  /*
    Honours `next`, as sign-in does. Someone who followed an invitation and had
    no account yet arrives here; sending them to the dashboard afterwards drops
    them into an empty workspace of their own, having silently lost the
    invitation they clicked. Same-origin paths only, so this cannot be turned
    into an open redirect.
  */
  const next = params.get('next');

  React.useEffect(() => {
    if (state.ok) {
      // Navigate first, then refresh. Refreshing first re-runs the page's own
      // server component with the new session, and its redirect would land
      // before this push does.
      router.push(next?.startsWith('/') && !next.startsWith('//') ? next : '/dashboard');
      router.refresh();
    }
  }, [state.ok, router, next]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-semibold tracking-tight text-fg">Create your workspace</h1>
        <p className="text-sm text-fg-muted">
          Start collecting feedback from every project in one place.
        </p>
      </div>

      <ProviderButtons providers={providers} verb="Sign up with" next={next ?? undefined} />

      <form action={formAction} className="flex flex-col gap-4">
        <FormError message={state.code !== 'validation_error' ? state.error : undefined} />

        <Field error={state.fieldErrors?.name}>
          <FieldLabel>Name</FieldLabel>
          <Input name="name" autoComplete="name" placeholder="Ada Lovelace" required autoFocus />
        </Field>

        <Field error={state.fieldErrors?.email}>
          <FieldLabel>Email</FieldLabel>
          <Input
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            required
          />
        </Field>

        <Field error={state.fieldErrors?.password}>
          <FieldLabel>Password</FieldLabel>
          <Input
            name="password"
            type="password"
            autoComplete="new-password"
            placeholder="At least 10 characters"
            minLength={10}
            required
          />
        </Field>

        <Field error={state.fieldErrors?.workspaceName}>
          <FieldLabel optional>Workspace name</FieldLabel>
          <Input name="workspaceName" placeholder="Personal projects" />
        </Field>

        <Button type="submit" loading={pending} className="mt-1 w-full">
          Create account
        </Button>
      </form>

      <p className="text-center text-sm text-fg-muted">
        Already have an account?{' '}
        <Link
          href={withNext('/login', next)}
          className="font-medium text-accent-500 hover:underline"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
