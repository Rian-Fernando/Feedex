import 'server-only';

import { createHash, randomBytes } from 'node:crypto';
import { cookies, headers } from 'next/headers';
import { and, eq, gt, lt } from 'drizzle-orm';

import { getDb } from '@/lib/db';
import { sessions, users, type User } from '@/lib/db/schema';
import { isProduction } from '@/config/env';

export const SESSION_COOKIE = 'feedex_session';

/** Sessions last 30 days, sliding: any request within the window extends it. */
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** Refresh the expiry at most once per day to avoid a write on every request. */
const SESSION_REFRESH_THRESHOLD_MS = 24 * 60 * 60 * 1000;

/**
 * The cookie carries a 256-bit opaque token; the database stores only its
 * SHA-256. A leaked database snapshot therefore cannot be replayed as a login.
 * SHA-256 is sufficient here (unlike for passwords) because the token is
 * high-entropy random rather than user-chosen.
 */
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export interface SessionContext {
  user: User;
  sessionId: string;
  expiresAt: Date;
}

export async function createSession(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const db = await getDb();
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  const headerList = await headers();

  await db.insert(sessions).values({
    id: hashToken(token),
    userId,
    expiresAt,
    userAgent: headerList.get('user-agent')?.slice(0, 512) ?? null,
    ipAddress: clientIp(headerList),
  });

  return { token, expiresAt };
}

export async function setSessionCookie(token: string, expiresAt: Date): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: isProduction(),
    // `lax` lets the cookie ride along on top-level navigations back into the
    // app while still blocking it on cross-site subrequests, which is the
    // CSRF-relevant case for a cookie-authenticated dashboard.
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  });
}

/**
 * Resolves the current session from the request cookie.
 *
 * Returns `null` for missing, unknown, or expired tokens. Expired rows are left
 * for the sweeper rather than deleted inline so that reads stay read-only.
 */
export async function getSession(): Promise<SessionContext | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const db = await getDb();
  const rows = await db
    .select({ session: sessions, user: users })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.id, hashToken(token)), gt(sessions.expiresAt, new Date())))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  // Sliding expiry: extend only when the session is more than a day into its
  // lifetime, so an active user is never logged out mid-session.
  const remaining = row.session.expiresAt.getTime() - Date.now();
  if (remaining < SESSION_TTL_MS - SESSION_REFRESH_THRESHOLD_MS) {
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
    await db.update(sessions).set({ expiresAt }).where(eq(sessions.id, row.session.id));
  }

  return {
    user: row.user,
    sessionId: row.session.id,
    expiresAt: row.session.expiresAt,
  };
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;

  if (token) {
    const db = await getDb();
    await db.delete(sessions).where(eq(sessions.id, hashToken(token)));
  }

  store.delete(SESSION_COOKIE);
}

/** Invalidates every session for a user, e.g. after a password change. */
export async function destroyAllSessions(userId: string): Promise<void> {
  const db = await getDb();
  await db.delete(sessions).where(eq(sessions.userId, userId));
}

/** Removes expired rows. Safe to call opportunistically. */
export async function sweepExpiredSessions(): Promise<void> {
  const db = await getDb();
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
}

function clientIp(headerList: Headers): string | null {
  const forwarded = headerList.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]?.trim().slice(0, 64) ?? null;
  return headerList.get('x-real-ip')?.slice(0, 64) ?? null;
}
