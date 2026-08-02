import { Suspense } from 'react';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { currentUser } from '@/lib/auth';
import { LoginForm } from '@/components/auth/auth-forms';
import { enabledProviders } from '@/lib/auth/oauth';
import { Skeleton } from '@/components/ui/misc';

// Reads the session cookie to bounce already-authenticated visitors.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Sign in',
  description: 'Sign in to your Feedex workspace to review and resolve feedback.',
  robots: { index: false, follow: false },
};

export default async function LoginPage() {
  if (await currentUser()) redirect('/dashboard');

  return (
    // `useSearchParams` in the form requires a Suspense boundary above it.
    <Suspense fallback={<Skeleton className="h-80 w-full" />}>
      <LoginForm providers={enabledProviders()} />
    </Suspense>
  );
}
