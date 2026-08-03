import 'server-only';

import { createHash, randomBytes } from 'node:crypto';

import { appUrl } from '@/config/env';
import { AppError } from '@/lib/errors';

/**
 * OAuth 2.0 sign-in.
 *
 * Implemented directly against the providers rather than through a framework.
 * The flow is small — an authorization redirect, a code exchange, one profile
 * request — and doing it here keeps the session model unchanged: a provider
 * sign-in ends in exactly the same opaque database-backed session that a
 * password sign-in produces.
 *
 * Both providers are optional. A provider with no credentials configured is
 * simply absent from the sign-in page, so a self-hosted instance can run with
 * passwords only, or with one provider, or with both.
 */

export type ProviderId = 'google' | 'github';

/**
 * Scope needed to open issues on a user's behalf.
 *
 * Requested only when someone explicitly connects a repository, never at
 * sign-in. Asking every new user for write access to their private
 * repositories just so a subset can file issues is the kind of consent screen
 * that makes people close the tab — and it would be an honest reaction, since
 * most of them would never use it.
 *
 * `repo` rather than `public_repo` because the repositories people actually
 * track feedback against are usually private. GitHub has no narrower scope
 * that grants issue creation.
 */
export const GITHUB_ISSUES_SCOPE = 'read:user user:email repo';

/** A normalised profile, whatever the provider's own shape was. */
export interface OAuthProfile {
  providerAccountId: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  /**
   * Whether the provider asserts the email is verified.
   *
   * Load-bearing: an unverified email must never be allowed to link into an
   * existing account, or signing up with someone else's address at a sloppy
   * provider would hand over their workspace.
   */
  emailVerified: boolean;
}

export interface TokenSet {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date | null;
  scope: string | null;
}

interface ProviderConfig {
  id: ProviderId;
  label: string;
  authorizeUrl: string;
  tokenUrl: string;
  scope: string;
  /** Whether to send a PKCE challenge. */
  usePkce: boolean;
  clientId: () => string | undefined;
  clientSecret: () => string | undefined;
  fetchProfile: (accessToken: string) => Promise<OAuthProfile>;
}

/* ------------------------------- providers ------------------------------- */

const PROVIDERS: Record<ProviderId, ProviderConfig> = {
  google: {
    id: 'google',
    label: 'Google',
    authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scope: 'openid email profile',
    usePkce: true,
    clientId: () => process.env.GOOGLE_CLIENT_ID,
    clientSecret: () => process.env.GOOGLE_CLIENT_SECRET,

    async fetchProfile(accessToken) {
      const response = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!response.ok) {
        throw AppError.unauthorized('Google did not return a profile.');
      }

      const data = (await response.json()) as {
        sub: string;
        email?: string;
        email_verified?: boolean;
        name?: string;
        given_name?: string;
        picture?: string;
      };

      if (!data.email) {
        throw AppError.validation('Your Google account has no email address available.');
      }

      return {
        providerAccountId: data.sub,
        email: data.email.toLowerCase(),
        name: data.name || data.given_name || data.email.split('@')[0] || 'New user',
        avatarUrl: data.picture ?? null,
        emailVerified: data.email_verified === true,
      };
    },
  },

  github: {
    id: 'github',
    label: 'GitHub',
    authorizeUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    scope: 'read:user user:email',
    // GitHub accepts a PKCE challenge but does not require or document it;
    // state is what actually protects this flow there.
    usePkce: false,
    clientId: () => process.env.GITHUB_CLIENT_ID,
    clientSecret: () => process.env.GITHUB_CLIENT_SECRET,

    async fetchProfile(accessToken) {
      const headers = {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'Feedex',
      };

      const [userResponse, emailResponse] = await Promise.all([
        fetch('https://api.github.com/user', { headers }),
        // The profile's `email` is whatever the user made public, which is
        // often nothing. The addresses endpoint is the authoritative one and
        // is the only place verification status is reported.
        fetch('https://api.github.com/user/emails', { headers }),
      ]);

      if (!userResponse.ok) {
        throw AppError.unauthorized('GitHub did not return a profile.');
      }

      const user = (await userResponse.json()) as {
        id: number;
        login: string;
        name?: string | null;
        email?: string | null;
        avatar_url?: string;
      };

      let email = user.email?.toLowerCase() ?? null;
      let emailVerified = false;

      if (emailResponse.ok) {
        const emails = (await emailResponse.json()) as Array<{
          email: string;
          primary: boolean;
          verified: boolean;
        }>;

        const primary = emails.find((entry) => entry.primary && entry.verified);
        const anyVerified = emails.find((entry) => entry.verified);
        const chosen = primary ?? anyVerified;

        if (chosen) {
          email = chosen.email.toLowerCase();
          emailVerified = true;
        }
      }

      if (!email) {
        throw AppError.validation(
          'Your GitHub account has no verified email address. Add one in your GitHub settings and try again.',
        );
      }

      return {
        providerAccountId: String(user.id),
        email,
        name: user.name || user.login,
        avatarUrl: user.avatar_url ?? null,
        emailVerified,
      };
    },
  },
};

/* -------------------------------- helpers -------------------------------- */

export function getProvider(id: string): ProviderConfig {
  const provider = PROVIDERS[id as ProviderId];
  if (!provider) throw AppError.notFound('Unknown sign-in provider.');
  return provider;
}

/** Whether a provider has credentials configured on this instance. */
export function isProviderEnabled(id: ProviderId): boolean {
  const provider = PROVIDERS[id];
  return Boolean(provider.clientId() && provider.clientSecret());
}

/** The providers this instance can actually offer. Drives the sign-in page. */
export function enabledProviders(): Array<{ id: ProviderId; label: string }> {
  return (Object.keys(PROVIDERS) as ProviderId[])
    .filter(isProviderEnabled)
    .map((id) => ({ id, label: PROVIDERS[id].label }));
}

export function callbackUrl(id: ProviderId): string {
  return new URL(`/api/auth/${id}/callback`, appUrl()).toString();
}

/* --------------------------------- PKCE ---------------------------------- */

export interface AuthorizationRequest {
  url: string;
  state: string;
  codeVerifier: string | null;
}

function base64url(buffer: Buffer): string {
  return buffer.toString('base64url');
}

/**
 * Builds the authorization redirect.
 *
 * The returned `state` and `codeVerifier` must be stored in a short-lived,
 * httpOnly cookie and checked on the way back — that is what stops an attacker
 * from feeding the callback a code they obtained themselves.
 */
export function buildAuthorization(id: ProviderId, scopeOverride?: string): AuthorizationRequest {
  const provider = getProvider(id);
  const clientId = provider.clientId();

  if (!clientId || !provider.clientSecret()) {
    throw AppError.notFound(`${provider.label} sign-in is not configured on this instance.`);
  }

  const state = base64url(randomBytes(24));
  const codeVerifier = provider.usePkce ? base64url(randomBytes(32)) : null;

  const url = new URL(provider.authorizeUrl);
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', callbackUrl(id));
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', scopeOverride ?? provider.scope);
  url.searchParams.set('state', state);

  if (codeVerifier) {
    url.searchParams.set(
      'code_challenge',
      base64url(createHash('sha256').update(codeVerifier).digest()),
    );
    url.searchParams.set('code_challenge_method', 'S256');
  }

  if (id === 'google') {
    // Ask for a stable account choice rather than silently reusing whichever
    // Google session happens to be active.
    url.searchParams.set('prompt', 'select_account');
  }

  return { url: url.toString(), state, codeVerifier };
}

/* ------------------------------ code exchange ----------------------------- */

export async function exchangeCode(
  id: ProviderId,
  code: string,
  codeVerifier: string | null,
): Promise<TokenSet> {
  const provider = getProvider(id);
  const clientId = provider.clientId();
  const clientSecret = provider.clientSecret();

  if (!clientId || !clientSecret) {
    throw AppError.notFound(`${provider.label} sign-in is not configured on this instance.`);
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    grant_type: 'authorization_code',
    redirect_uri: callbackUrl(id),
  });

  if (codeVerifier) body.set('code_verifier', codeVerifier);

  const response = await fetch(provider.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      // GitHub returns form-encoded unless JSON is requested explicitly.
      Accept: 'application/json',
    },
    body,
  });

  if (!response.ok) {
    throw AppError.unauthorized(`${provider.label} rejected the sign-in attempt.`);
  }

  const data = (await response.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
    error?: string;
  };

  if (data.error || !data.access_token) {
    throw AppError.unauthorized(`${provider.label} did not return an access token.`);
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? null,
    expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : null,
    scope: data.scope ?? null,
  };
}

export function fetchProfile(id: ProviderId, accessToken: string): Promise<OAuthProfile> {
  return getProvider(id).fetchProfile(accessToken);
}
