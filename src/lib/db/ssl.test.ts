import { describe, expect, it } from 'vitest';

import { pinSslMode } from './index';

/**
 * These assertions are about a security property, not a formatting detail.
 *
 * `pg` currently treats `sslmode=require` as full verification but warns that a
 * future major will switch it to libpq semantics, where it encrypts without
 * authenticating the server. That change would silently downgrade every
 * provider-issued connection string on a dependency bump, so the intent is
 * pinned in the URL and checked here.
 */
describe('pinSslMode', () => {
  it('upgrades the modes that are about to change meaning', () => {
    for (const mode of ['require', 'prefer', 'verify-ca']) {
      expect(pinSslMode(`postgres://u:p@host/db?sslmode=${mode}`)).toBe(
        'postgres://u:p@host/db?sslmode=verify-full',
      );
    }
  });

  it('leaves an already-explicit verify-full alone', () => {
    const url = 'postgres://u:p@host/db?sslmode=verify-full';
    expect(pinSslMode(url)).toBe(url);
  });

  it('preserves the documented escape hatches', () => {
    // Self-hosted Postgres on a self-signed certificate depends on these, so
    // they must never be rewritten into verification.
    for (const mode of ['disable', 'no-verify']) {
      const url = `postgres://u:p@host/db?sslmode=${mode}`;
      expect(pinSslMode(url)).toBe(url);
    }
  });

  it('keeps other query parameters intact', () => {
    expect(pinSslMode('postgres://u:p@host/db?sslmode=require&application_name=feedex')).toBe(
      'postgres://u:p@host/db?sslmode=verify-full&application_name=feedex',
    );
  });

  it('leaves a URL with no sslmode untouched', () => {
    const url = 'postgres://u:p@host/db';
    expect(pinSslMode(url)).toBe(url);
  });
});
