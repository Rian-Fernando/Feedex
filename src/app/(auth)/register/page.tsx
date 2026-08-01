import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';

import { env } from '@/config/env';
import { currentUser } from '@/lib/auth';
import { RegisterForm } from '@/components/auth/auth-forms';

// Reads the session cookie to bounce already-authenticated visitors.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Create your workspace',
  description: 'Create a Feedex workspace and start collecting feedback from every project.',
  robots: { index: false, follow: false },
};

export default async function RegisterPage() {
  if (env().DISABLE_SIGNUP) notFound();
  if (await currentUser()) redirect('/dashboard');

  return <RegisterForm />;
}
