import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

import { isProduction } from '@/config/env';
import {
  buildAuthorization,
  getProvider,
  GITHUB_ISSUES_SCOPE,
  type ProviderId,
} from '@/lib/auth/oauth';
import { apiError } from '@/lib/api/response';

/**
 * Starts an OAuth sign-in.
 *
 * `GET /api/auth/google` or `/api/auth/github` redirects to the provider. The
 * one-time state (and PKCE verifier, where the provider supports it) is stored
 * in a short-lived httpOnly cookie so the callback can prove the response
 * belongs to a flow this browser actually started.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Ten minutes is far longer than a consent screen takes, and short enough. */
const FLOW_TTL_SECONDS = 600;

export const STATE_COOKIE = 'feedex_oauth';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ provider: string }> },
): Promise<NextResponse> {
  try {
    const { provider: id } = await params;
    const provider = getProvider(id);

    /*
      Two different journeys share this route. `connect` is an already
      signed-in user granting Feedex the extra scope needed to open issues;
      everything else is a sign-in. The distinction is carried in the state
      cookie so the callback knows whether to create a session or to attach a
      token to the session that already exists.
    */
    const intent =
      new URL(request.url).searchParams.get('intent') === 'connect' ? 'connect' : 'signin';

    const scope =
      intent === 'connect' && provider.id === 'github' ? GITHUB_ISSUES_SCOPE : undefined;

    const { url, state, codeVerifier } = buildAuthorization(provider.id as ProviderId, scope);

    // Where to land afterwards. Only same-origin paths, so the callback can
    // never be used as an open redirect.
    const next = new URL(request.url).searchParams.get('next');
    const returnTo = next && next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard';

    const store = await cookies();
    store.set(
      STATE_COOKIE,
      JSON.stringify({ p: provider.id, s: state, v: codeVerifier, r: returnTo, i: intent }),
      {
        httpOnly: true,
        secure: isProduction(),
        // `lax` still arrives on the provider's top-level redirect back to us.
        sameSite: 'lax',
        path: '/',
        maxAge: FLOW_TTL_SECONDS,
      },
    );

    return NextResponse.redirect(url);
  } catch (error) {
    return apiError(error);
  }
}
