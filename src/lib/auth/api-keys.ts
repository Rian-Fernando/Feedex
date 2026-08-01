import 'server-only';

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

import { authSecret } from '@/config/env';

/**
 * Two key classes with deliberately different threat models.
 *
 * A **public** key ships inside a `<script>` tag on someone else's website. It
 * is not a secret and cannot be treated as one; its only capability is "create
 * feedback for this project". It is stored verbatim so ingestion is a single
 * indexed lookup, and abuse is bounded by rate limiting and origin checks
 * rather than by confidentiality.
 *
 * A **secret** key authenticates server-to-server calls that can read and
 * mutate data. It is shown once at creation and stored only as an HMAC, so a
 * database compromise does not yield usable credentials. HMAC rather than a
 * plain hash means an attacker also needs `AUTH_SECRET` to build a lookup table,
 * and being deterministic it stays a single indexed lookup.
 */
export type KeyType = 'public' | 'secret';

const PREFIXES: Record<KeyType, string> = {
  public: 'pk_fdx',
  secret: 'sk_fdx',
};

const KEY_BYTES = 24;

export interface GeneratedKey {
  /** Full key, returned to the caller exactly once. */
  token: string;
  /** Value to persist in `api_keys.key_hash`. */
  storedHash: string;
  /** Non-secret fragment shown in the UI to identify the key. */
  prefix: string;
}

export function generateApiKey(type: KeyType): GeneratedKey {
  const random = randomBytes(KEY_BYTES).toString('base64url');
  const token = `${PREFIXES[type]}_${random}`;

  return {
    token,
    storedHash: type === 'public' ? token : hashSecretKey(token),
    prefix: token.slice(0, 16),
  };
}

export function hashSecretKey(token: string): string {
  return createHmac('sha256', authSecret()).update(token).digest('hex');
}

/**
 * Returns the value to look up in `api_keys.key_hash` for a presented token,
 * or `null` if the token is not a well-formed Feedex key.
 */
export function lookupHashFor(token: string): { type: KeyType; hash: string } | null {
  if (token.startsWith(`${PREFIXES.public}_`)) {
    return { type: 'public', hash: token };
  }
  if (token.startsWith(`${PREFIXES.secret}_`)) {
    return { type: 'secret', hash: hashSecretKey(token) };
  }
  return null;
}

/** Constant-time comparison for equal-length hex digests. */
export function safeEqual(a: string, b: string): boolean {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  if (bufferA.length !== bufferB.length) return false;
  return timingSafeEqual(bufferA, bufferB);
}

/** Masks a key for display, e.g. `pk_fdx_9fK2…`. */
export function maskKey(prefix: string): string {
  return `${prefix}${'…'}`;
}
