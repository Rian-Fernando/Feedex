import 'server-only';

import { and, eq, sql } from 'drizzle-orm';

import { getDb } from '@/lib/db';
import { apiKeys, projects, type Project } from '@/lib/db/schema';
import { lookupHashFor } from '@/lib/auth/api-keys';
import { AppError } from '@/lib/errors';

/**
 * Authentication for the machine-facing surfaces: the widget ingestion endpoint
 * and the REST API. Distinct from session auth in `src/lib/auth`, which covers
 * the browser-facing dashboard.
 */

export interface ApiKeyContext {
  keyId: string;
  keyType: 'public' | 'secret';
  workspaceId: string;
  project: Project;
}

/**
 * Resolves a presented key to its project.
 *
 * Revoked keys and keys belonging to archived or paused projects are rejected
 * here rather than at the call site, so every consumer inherits the same rules.
 */
export async function authenticateApiKey(
  token: string,
  expected: 'public' | 'secret',
): Promise<ApiKeyContext> {
  const lookup = lookupHashFor(token);
  if (!lookup || lookup.type !== expected) {
    throw AppError.unauthorized(
      expected === 'public'
        ? 'Invalid or missing project key.'
        : 'Invalid or missing API key. Expected a key beginning with sk_fdx_.',
    );
  }

  const db = await getDb();
  const rows = await db
    .select({ key: apiKeys, project: projects })
    .from(apiKeys)
    .innerJoin(projects, eq(apiKeys.projectId, projects.id))
    .where(
      and(
        eq(apiKeys.keyHash, lookup.hash),
        eq(apiKeys.type, expected),
        sql`${apiKeys.revokedAt} is null`,
      ),
    )
    .limit(1);

  const row = rows[0];
  if (!row) throw AppError.unauthorized('That key is not recognised.');

  if (row.project.status === 'archived') {
    throw AppError.forbidden('This project is archived and is not accepting requests.');
  }
  if (row.project.status === 'paused' && expected === 'public') {
    throw AppError.forbidden('This project has paused feedback collection.');
  }

  return {
    keyId: row.key.id,
    keyType: row.key.type,
    workspaceId: row.project.workspaceId,
    project: row.project,
  };
}

/**
 * Records key usage.
 *
 * Fire-and-forget: a failure to write the timestamp must never fail the request
 * that succeeded.
 */
export async function touchApiKey(keyId: string): Promise<void> {
  try {
    const db = await getDb();
    await db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, keyId));
  } catch (error) {
    console.error('[feedex] failed to record api key usage', error);
  }
}

/**
 * Checks that a submission originates from a host the project declares.
 *
 * This is a hygiene control, not an authentication one — `Origin` is set by the
 * browser and absent on server-to-server calls, so it cannot be relied on
 * alone. A project with no configured domain accepts any origin, which is what
 * makes local development and preview deployments work.
 */
export function originAllowed(project: Project, origin: string | null): boolean {
  if (!project.domain) return true;
  if (!origin) return true;

  let host: string;
  try {
    host = new URL(origin).hostname.toLowerCase();
  } catch {
    return false;
  }

  const allowed = project.domain.toLowerCase();

  // localhost in any form is always permitted so the widget can be exercised
  // during development against a production project key.
  if (host === 'localhost' || host === '127.0.0.1' || host.endsWith('.localhost')) return true;

  return host === allowed || host.endsWith(`.${allowed}`);
}
