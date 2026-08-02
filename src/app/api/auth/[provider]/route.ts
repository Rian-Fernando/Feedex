import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

import { isProduction } from '@/config/env';
import { buildAuthorization, getProvider, type ProviderId } from '@/lib/auth/oauth';
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

    const { url, state, codeVerifier } = buildAuthorization(provider.id as ProviderId);

    // Where to land afterwards. Only same-origin paths, so the callback can
    // never be used as an open redirect.
    const next = new URL(request.url).searchParams.get('next');
    const returnTo = next && next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard';

    const store = await cookies();
    store.set(
      STATE_COOKIE,
      JSON.stringify({ p: provider.id, s: state, v: codeVerifier, r: returnTo }),
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
