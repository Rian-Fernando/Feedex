'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { env } from '@/config/env';
import { AppError, actionFailure, actionSuccess, type ActionResult } from '@/lib/errors';
import { fieldErrorsFrom, loginSchema, registerSchema } from '@/lib/validation';
import { createSession, destroySession, setActiveWorkspace, setSessionCookie } from '@/lib/auth';
import { RATE_LIMITS, consume } from '@/lib/rate-limit';
import { registerUser, verifyCredentials } from '@/server/services/accounts';

/**
 * Authentication actions.
 *
 * Each returns an `ActionResult` rather than throwing, so forms can render
 * field-level errors. `redirect()` is called by the caller after a success, not
 * here, because Next implements redirects by throwing and that would be caught
 * by the surrounding try/catch.
 */

function formValue(data: FormData, key: string): string {
  const value = data.get(key);
  return typeof value === 'string' ? value : '';
}

async function clientKey(prefix: string): Promise<string> {
  const headerList = await headers();
  const ip =
    headerList.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    headerList.get('x-real-ip') ??
    'unknown';
  return `${prefix}:${ip}`;
}

export async function registerAction(_prev: unknown, formData: FormData): Promise<ActionResult> {
  try {
    if (env().DISABLE_SIGNUP) {
      throw AppError.forbidden('Registration is disabled on this instance.');
    }

    const parsed = registerSchema.safeParse({
      name: formValue(formData, 'name'),
      email: formValue(formData, 'email'),
      password: formValue(formData, 'password'),
      workspaceName: formValue(formData, 'workspaceName') || undefined,
    });

    if (!parsed.success) {
      throw AppError.validation('Please check the form.', fieldErrorsFrom(parsed.error));
    }

    const { user, workspaceId } = await registerUser(parsed.data);

    const { token, expiresAt } = await createSession(user.id);
    await setSessionCookie(token, expiresAt);
    await setActiveWorkspace(workspaceId);

    return actionSuccess();
  } catch (error) {
    return actionFailure(error);
  }
}

export async function loginAction(_prev: unknown, formData: FormData): Promise<ActionResult> {
  try {
    // Throttled per IP so credential stuffing cannot run at full speed.
    const limit = await consume({ key: await clientKey('login'), ...RATE_LIMITS.login });
    if (!limit.allowed) {
      throw AppError.rateLimited('Too many sign-in attempts. Try again in a few minutes.');
    }

    const parsed = loginSchema.safeParse({
      email: formValue(formData, 'email'),
      password: formValue(formData, 'password'),
    });

    if (!parsed.success) {
      throw AppError.validation('Please check the form.', fieldErrorsFrom(parsed.error));
    }

    const user = await verifyCredentials(parsed.data.email, parsed.data.password);
    if (!user) {
      // One message for both causes, so the response cannot be used to test
      // whether an address is registered.
      throw AppError.validation('That email and password combination is not correct.');
    }

    const { token, expiresAt } = await createSession(user.id);
    await setSessionCookie(token, expiresAt);

    return actionSuccess();
  } catch (error) {
    return actionFailure(error);
  }
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect('/');
}
