import { beforeAll, describe, expect, it } from 'vitest';

/**
 * Scope selection.
 *
 * Worth pinning down because getting it wrong is quiet and expensive in both
 * directions: asking every new user for write access to their private
 * repositories at sign-in is the kind of consent screen that loses people, and
 * forgetting to ask when they connect a repository produces a 403 from GitHub
 * long after the moment anyone could act on it.
 */

process.env.GITHUB_CLIENT_ID = 'test-client-id';
process.env.GITHUB_CLIENT_SECRET = 'test-client-secret';
process.env.APP_URL = 'https://feedex.example.test';

let oauth: typeof import('./oauth');

beforeAll(async () => {
  oauth = await import('./oauth');
});

function scopeOf(url: string): string[] {
  return (new URL(url).searchParams.get('scope') ?? '').split(' ').filter(Boolean);
}

describe('GitHub authorization scopes', () => {
  it('asks only for identity at sign-in', () => {
    const scope = scopeOf(oauth.buildAuthorization('github').url);

    expect(scope).toContain('read:user');
    expect(scope).toContain('user:email');
    expect(scope).not.toContain('repo');
  });

  it('adds repository access only when connecting', () => {
    const scope = scopeOf(oauth.buildAuthorization('github', oauth.GITHUB_ISSUES_SCOPE).url);

    expect(scope).toContain('repo');
    // Still carries identity: the callback resolves the same profile either way.
    expect(scope).toContain('read:user');
  });

  it('sends the callback back to this instance', () => {
    const url = new URL(oauth.buildAuthorization('github').url);

    expect(url.searchParams.get('redirect_uri')).toBe(
      'https://feedex.example.test/api/auth/github/callback',
    );
  });

  it('carries a state parameter that differs every time', () => {
    const first = new URL(oauth.buildAuthorization('github').url).searchParams.get('state');
    const second = new URL(oauth.buildAuthorization('github').url).searchParams.get('state');

    expect(first).toBeTruthy();
    expect(first).not.toBe(second);
  });
});
