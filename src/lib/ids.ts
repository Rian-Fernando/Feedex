import { randomBytes } from 'node:crypto';

/**
 * Prefixed, sortable, URL-safe identifiers.
 *
 * The prefix makes IDs self-describing in logs and API responses (`prj_…` is
 * unambiguously a project) and prevents an ID from one table being accepted
 * where another is expected. The timestamp component keeps insertion roughly
 * ordered, which matters for index locality on the feedback table.
 */
const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';

export const ID_PREFIX = {
  user: 'usr',
  workspace: 'wsp',
  project: 'prj',
  feedback: 'fbk',
  attachment: 'att',
  note: 'nte',
  apiKey: 'key',
  label: 'lbl',
  savedView: 'viw',
  activity: 'act',
} as const;

export type IdPrefix = (typeof ID_PREFIX)[keyof typeof ID_PREFIX];

function randomSuffix(length: number): string {
  const bytes = randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += ALPHABET[bytes[i]! % ALPHABET.length];
  }
  return out;
}

/** Creates an identifier such as `prj_m4x9k2c1_a83jf0zq`. */
export function createId(prefix: IdPrefix): string {
  const time = Date.now().toString(36).padStart(8, '0');
  return `${prefix}_${time}_${randomSuffix(8)}`;
}

/** Converts a display name into a URL-safe slug. */
export function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

/**
 * Appends a short random suffix to a slug so that a collision can be resolved
 * without asking the user to pick a different name.
 */
export function uniquifySlug(slug: string): string {
  const base = slug || 'untitled';
  return `${base.slice(0, 40)}-${randomSuffix(4)}`;
}
