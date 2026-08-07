import 'server-only';

import { sql } from 'drizzle-orm';

import { getDb } from '@/lib/db';
import { rateLimits } from '@/lib/db/schema';

/**
 * Fixed-window rate limiting backed by Postgres.
 *
 * Kept in the database rather than in process memory because the app is
 * expected to run on more than one instance, where an in-memory counter would
 * silently multiply the effective limit by the instance count. The whole
 * check is a single atomic upsert, so concurrent requests cannot race past it.
 *
 * If throughput ever outgrows this, the replacement is a Redis implementation
 * behind the same `consume` signature — no call site changes.
 */
export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
}

export interface RateLimitOptions {
  /** Namespaced identifier, e.g. `ingest:prj_123:1.2.3.4`. */
  key: string;
  /** Maximum requests permitted per window. */
  limit: number;
  /** Window length in seconds. */
  windowSeconds: number;
}

export async function consume({
  key,
  limit,
  windowSeconds,
}: RateLimitOptions): Promise<RateLimitResult> {
  const db = await getDb();
  const now = new Date();
  const resetAt = new Date(now.getTime() + windowSeconds * 1000);

  // One statement, no read-then-write race: insert the counter, or increment it
  // if the window is still open, or restart it if the window has elapsed.
  const rows = await db
    .insert(rateLimits)
    .values({ key, count: 1, expiresAt: resetAt })
    .onConflictDoUpdate({
      target: rateLimits.key,
      set: {
        count: sql`case when ${rateLimits.expiresAt} > now() then ${rateLimits.count} + 1 else 1 end`,
        expiresAt: sql`case when ${rateLimits.expiresAt} > now() then ${rateLimits.expiresAt} else ${resetAt.toISOString()}::timestamptz end`,
      },
    })
    .returning({ count: rateLimits.count, expiresAt: rateLimits.expiresAt });

  const row = rows[0];
  if (!row) {
    // Should be unreachable; fail open rather than blocking legitimate traffic
    // on an infrastructure hiccup.
    return { allowed: true, remaining: limit - 1, resetAt };
  }

  return {
    allowed: row.count <= limit,
    remaining: Math.max(0, limit - row.count),
    resetAt: row.expiresAt,
  };
}

/** Deletes elapsed windows. Called opportunistically from ingestion. */
export async function sweepRateLimits(): Promise<void> {
  const db = await getDb();
  await db.delete(rateLimits).where(sql`${rateLimits.expiresAt} < now() - interval '1 hour'`);
}

/** Default budgets, tuned for a widget on a public marketing site. */
export const RATE_LIMITS = {
  /** Per IP address, across all projects. */
  ingestPerIp: { limit: 20, windowSeconds: 60 },
  /** Per project, to bound the blast radius of one leaked public key. */
  ingestPerProject: { limit: 240, windowSeconds: 60 },
  /** Authenticated REST API, per secret key. */
  apiPerKey: { limit: 120, windowSeconds: 60 },
  /** Sign-in attempts, per IP address. */
  login: { limit: 10, windowSeconds: 300 },
  /**
   * Sign-ups, per IP address.
   *
   * Cheaper to abuse than it looks: each one creates a user, a workspace, a
   * membership, and twelve label rows. Left open it is a resource-exhaustion
   * vector that costs an attacker one HTTP request.
   */
  register: { limit: 5, windowSeconds: 3600 },
  /** Invitations created, per workspace. Bounds a compromised admin session. */
  invite: { limit: 30, windowSeconds: 3600 },
  /**
   * Invitation acceptances, per IP address.
   *
   * Tokens are 32 random bytes, so guessing one is not realistic — this exists
   * so that trying is visibly futile rather than merely improbable, and so a
   * script hammering the endpoint stops being free.
   */
  inviteAccept: { limit: 20, windowSeconds: 3600 },
  /**
   * Widget configuration reads, per IP address.
   *
   * Almost every real request is absorbed by the edge cache. This bounds the
   * ones that are not — a cache-busting query string still reaches the origin,
   * and this endpoint now writes `last_used_at`.
   */
  widgetConfig: { limit: 120, windowSeconds: 60 },
} as const;
