import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

import { env } from '@/config/env';
import { AppError, isAppError } from '@/lib/errors';
import { exchangeCode, fetchProfile, getProvider, type ProviderId } from '@/lib/auth/oauth';
import { createSession, setSessionCookie, setActiveWorkspace } from '@/lib/auth';
import { signInWithProvider } from '@/server/services/accounts';
import { listUserWorkspaces } from '@/server/services/workspaces';
import { RATE_LIMITS, consume } from '@/lib/rate-limit';
import { clientIp } from '@/lib/api/response';
import { STATE_COOKIE } from '../route';

/**
 * Completes an OAuth sign-in.
 *
 * Verifies the state cookie, exchanges the code, resolves the profile to a
 * user, and establishes exactly the same session a password sign-in would.
 * Failures redirect back to /login with a readable message rather than
 * rendering a JSON error at a URL the visitor did not choose to visit.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface FlowState {
  p: string;
  s: string;
  v: string | null;
  r: string;
}

function failure(message: string): NextResponse {
  const url = new URL('/login', env().APP_URL);
  url.searchParams.set('error', message);
  return NextResponse.redirect(url);
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ provider: string }> },
): Promise<NextResponse> {
  const store = await cookies();

  try {
    const { provider: id } = await params;
    const provider = getProvider(id);

    // Throttled per IP: the exchange hits a third party and creates accounts.
    const limit = await consume({
      key: `oauth:${clientIp(request)}`,
      ...RATE_LIMITS.login,
    });
    if (!limit.allowed) {
      throw AppError.rateLimited('Too many sign-in attempts. Try again in a few minutes.');
    }

    const query = new URL(request.url).searchParams;

    // The provider reports user-facing refusals here, not as an HTTP error.
    const providerError = query.get('error');
    if (providerError) {
      throw AppError.unauthorized(
        providerError === 'access_denied'
          ? 'Sign-in was cancelled.'
          : `${provider.label} declined the sign-in.`,
      );
    }

    const raw = store.get(STATE_COOKIE)?.value;
    if (!raw) {
      throw AppError.unauthorized('That sign-in link has expired. Please try again.');
    }

    let flow: FlowState;
    try {
      flow = JSON.parse(raw) as FlowState;
    } catch {
      throw AppError.unauthorized('That sign-in could not be verified. Please try again.');
    }

    const state = query.get('state');
    const code = query.get('code');

    // The state check is what ties this response to a flow this browser
    // started; without it an attacker could feed us their own code.
    if (!state || !code || flow.s !== state || flow.p !== provider.id) {
      throw AppError.unauthorized('That sign-in could not be verified. Please try again.');
    }

    const tokens = await exchangeCode(provider.id as ProviderId, code, flow.v);
    const profile = await fetchProfile(provider.id as ProviderId, tokens.accessToken);

    const { user } = await signInWithProvider({
      provider: provider.id,
      profile,
      tokens,
    });

    const { token, expiresAt } = await createSession(user.id);
    await setSessionCookie(token, expiresAt);

    const workspaces = await listUserWorkspaces(user.id);
    if (workspaces[0]) await setActiveWorkspace(workspaces[0].id);

    store.delete(STATE_COOKIE);

    return NextResponse.redirect(new URL(flow.r, env().APP_URL));
  } catch (error) {
    store.delete(STATE_COOKIE);

    if (isAppError(error)) return failure(error.message);

    console.error('[feedex] oauth callback failed', error);
    return failure('Sign-in failed. Please try again.');
  }
}
