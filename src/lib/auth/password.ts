import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
  type ScryptOptions,
} from 'node:crypto';
import { promisify } from 'node:util';

/**
 * `promisify` resolves to the three-argument overload, which cannot express the
 * tuning parameters below, so the options-taking signature is restated here.
 */
const scrypt = promisify(scryptCallback) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
  options: ScryptOptions,
) => Promise<Buffer>;

/**
 * Password hashing built on Node's native scrypt.
 *
 * scrypt is memory-hard, ships in the standard library, and needs no native
 * addon — which keeps the deployment target (including serverless runtimes with
 * no build step) unconstrained. Parameters follow the OWASP recommendation of
 * N=2^16, r=8, p=1.
 *
 * The stored format is self-describing so that parameters can be raised later
 * and old hashes transparently upgraded on next successful login.
 */
const SCRYPT_PARAMS = {
  N: 65_536,
  r: 8,
  p: 1,
  keyLength: 64,
  // scrypt's memory use is roughly 128 * N * r bytes; Node's default 32 MB cap
  // is below what N=2^16 needs.
  maxmem: 256 * 1024 * 1024,
} as const;

const SALT_BYTES = 16;
const FORMAT_VERSION = 'scrypt$1';

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const derived = await scrypt(password.normalize('NFKC'), salt, SCRYPT_PARAMS.keyLength, {
    N: SCRYPT_PARAMS.N,
    r: SCRYPT_PARAMS.r,
    p: SCRYPT_PARAMS.p,
    maxmem: SCRYPT_PARAMS.maxmem,
  });

  return [
    FORMAT_VERSION,
    SCRYPT_PARAMS.N,
    SCRYPT_PARAMS.r,
    SCRYPT_PARAMS.p,
    salt.toString('base64url'),
    derived.toString('base64url'),
  ].join('$');
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  // "scrypt", "1", N, r, p, salt, hash
  if (parts.length !== 7 || parts[0] !== 'scrypt') return false;

  const N = Number(parts[2]);
  const r = Number(parts[3]);
  const p = Number(parts[4]);
  const salt = parts[5];
  const expected = parts[6];

  if (!Number.isFinite(N) || !Number.isFinite(r) || !Number.isFinite(p) || !salt || !expected) {
    return false;
  }

  const expectedBuffer = Buffer.from(expected, 'base64url');

  let derived: Buffer;
  try {
    derived = await scrypt(
      password.normalize('NFKC'),
      Buffer.from(salt, 'base64url'),
      expectedBuffer.length,
      { N, r, p, maxmem: SCRYPT_PARAMS.maxmem },
    );
  } catch {
    return false;
  }

  if (derived.length !== expectedBuffer.length) return false;
  return timingSafeEqual(derived, expectedBuffer);
}

/**
 * Burns roughly the same time as a real verification.
 *
 * Called when no user matches the submitted email so that response timing does
 * not reveal which addresses have accounts.
 */
export async function fakeVerify(): Promise<void> {
  await scrypt('feedex-timing-equalizer', randomBytes(SALT_BYTES), SCRYPT_PARAMS.keyLength, {
    N: SCRYPT_PARAMS.N,
    r: SCRYPT_PARAMS.r,
    p: SCRYPT_PARAMS.p,
    maxmem: SCRYPT_PARAMS.maxmem,
  });
}
