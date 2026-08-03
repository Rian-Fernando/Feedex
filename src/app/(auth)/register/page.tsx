import { Suspense } from 'react';
import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';

import { env } from '@/config/env';
import { currentUser } from '@/lib/auth';
import { RegisterForm } from '@/components/auth/auth-forms';
import { enabledProviders } from '@/lib/auth/oauth';
import { Skeleton } from '@/components/ui/misc';

// Reads the session cookie to bounce already-authenticated visitors.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Create your workspace',
  description: 'Create a Feedex workspace and start collecting feedback from every project.',
  robots: { index: false, follow: false },
};

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  if (env().DISABLE_SIGNUP) notFound();

  const { next } = await searchParams;

  /*
    Honours `next` for the same reason the form does. `router.refresh()` after
    a successful sign-up re-runs this component with a session in place, so a
    hard-coded /dashboard here wins the race against the client-side push and
    an invitee loses the invitation they came in with.

    Same-origin paths only, so this cannot be used as an open redirect.
  */
  if (await currentUser()) {
    redirect(next?.startsWith('/') && !next.startsWith('//') ? next : '/dashboard');
  }

  return (
    // `useSearchParams` in the form requires a Suspense boundary above it.
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <RegisterForm providers={enabledProviders()} />
    </Suspense>
  );
}
