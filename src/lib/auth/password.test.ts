import { describe, expect, it } from 'vitest';

import { hashPassword, verifyPassword } from './password';

/**
 * Password hashing is the one place where a silent regression is a security
 * incident rather than a bug, so the properties are asserted directly.
 */
describe('password hashing', () => {
  it('verifies a correct password', async () => {
    const hash = await hashPassword('correct horse battery staple');
    await expect(verifyPassword('correct horse battery staple', hash)).resolves.toBe(true);
  });

  it('rejects an incorrect password', async () => {
    const hash = await hashPassword('correct horse battery staple');
    await expect(verifyPassword('Correct horse battery staple', hash)).resolves.toBe(false);
  });

  it('salts, so identical passwords produce different hashes', async () => {
    const [a, b] = await Promise.all([
      hashPassword('same-password'),
      hashPassword('same-password'),
    ]);
    expect(a).not.toEqual(b);
  });

  it('stores parameters in the hash so they can be raised later', async () => {
    const hash = await hashPassword('whatever-you-like');
    const [scheme, version, n, r, p] = hash.split('$');

    expect(scheme).toBe('scrypt');
    expect(version).toBe('1');
    expect(Number(n)).toBe(65_536);
    expect(Number(r)).toBe(8);
    expect(Number(p)).toBe(1);
  });

  it('never throws on a malformed stored hash', async () => {
    for (const malformed of ['', 'not-a-hash', 'scrypt$1$bad', '$$$$$$']) {
      await expect(verifyPassword('anything', malformed)).resolves.toBe(false);
    }
  });

  it('normalises unicode, so the same typed password matches either encoding', async () => {
    // Escapes rather than literals, so the assertion cannot be defeated by the
    // editor or the file encoding silently normalising one of them.
    const composed = 'caf\u00E9-password'; // é as a single code point
    const decomposed = 'cafe\u0301-password'; // e + combining acute

    expect(composed).not.toBe(decomposed);

    const hash = await hashPassword(composed);
    await expect(verifyPassword(decomposed, hash)).resolves.toBe(true);
  });
});
