import 'server-only';

import { and, asc, count, eq } from 'drizzle-orm';

import { getDb } from '@/lib/db';
import { savedViews, type SavedView } from '@/lib/db/schema';
import { createId, ID_PREFIX } from '@/lib/ids';
import { AppError } from '@/lib/errors';

/**
 * Saved filter combinations, scoped to one person in one workspace.
 *
 * Every query filters on both, so a view is invisible to anyone else even if
 * they hold its id.
 */

const MAX_VIEWS = 20;

export async function listViews(workspaceId: string, userId: string): Promise<SavedView[]> {
  const db = await getDb();

  return db
    .select()
    .from(savedViews)
    .where(and(eq(savedViews.workspaceId, workspaceId), eq(savedViews.userId, userId)))
    .orderBy(asc(savedViews.position), asc(savedViews.createdAt));
}

export async function createView(input: {
  workspaceId: string;
  userId: string;
  name: string;
  query: string;
}): Promise<SavedView> {
  const db = await getDb();

  const existing = await db
    .select({ value: count() })
    .from(savedViews)
    .where(and(eq(savedViews.workspaceId, input.workspaceId), eq(savedViews.userId, input.userId)));

  if ((existing[0]?.value ?? 0) >= MAX_VIEWS) {
    throw AppError.validation(`You can save up to ${MAX_VIEWS} views.`);
  }

  /*
    Stored without a leading `?` and with the transient parameters stripped.
    `page` in particular: saving "page 3 of my open bugs" and returning to it a
    week later lands on a page that no longer holds the same items, which reads
    as the view being broken.
  */
  const params = new URLSearchParams(input.query.replace(/^\?/, ''));
  params.delete('page');

  const rows = await db
    .insert(savedViews)
    .values({
      id: createId(ID_PREFIX.savedView),
      workspaceId: input.workspaceId,
      userId: input.userId,
      name: input.name,
      query: params.toString().slice(0, 1024),
      position: existing[0]?.value ?? 0,
    })
    .returning();

  const created = rows[0];
  if (!created) throw new Error('Insert returned no row.');
  return created;
}

export async function deleteView(
  workspaceId: string,
  userId: string,
  viewId: string,
): Promise<void> {
  const db = await getDb();

  await db.delete(savedViews).where(
    and(
      eq(savedViews.workspaceId, workspaceId),
      // Scoped to the owner too: a view belongs to a person, not a workspace.
      eq(savedViews.userId, userId),
      eq(savedViews.id, viewId),
    ),
  );
}
