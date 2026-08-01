import 'server-only';

import { desc, eq } from 'drizzle-orm';

import { getDb, type Database } from '@/lib/db';
import { activities, users, type ActivityAction } from '@/lib/db/schema';
import { createId, ID_PREFIX } from '@/lib/ids';

/**
 * Append-only audit trail.
 *
 * Recorded for every state change so the dashboard can show a timeline without
 * reconstructing history from mutable rows. Writes accept an optional
 * transaction handle so an activity entry commits atomically with the change it
 * describes.
 */
export interface RecordActivityInput {
  workspaceId: string;
  actorId?: string | null;
  action: ActivityAction;
  targetType: string;
  targetId: string;
  metadata?: Record<string, unknown>;
}

export async function recordActivity(input: RecordActivityInput, tx?: Database): Promise<void> {
  const db = tx ?? (await getDb());
  await db.insert(activities).values({
    id: createId(ID_PREFIX.activity),
    workspaceId: input.workspaceId,
    actorId: input.actorId ?? null,
    action: input.action,
    targetType: input.targetType,
    targetId: input.targetId,
    metadata: input.metadata ?? {},
  });
}

export interface ActivityEntry {
  id: string;
  action: ActivityAction;
  targetType: string;
  targetId: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
  actorName: string | null;
}

export async function listActivity(workspaceId: string, limit = 20): Promise<ActivityEntry[]> {
  const db = await getDb();

  return db
    .select({
      id: activities.id,
      action: activities.action,
      targetType: activities.targetType,
      targetId: activities.targetId,
      metadata: activities.metadata,
      createdAt: activities.createdAt,
      actorName: users.name,
    })
    .from(activities)
    .leftJoin(users, eq(activities.actorId, users.id))
    .where(eq(activities.workspaceId, workspaceId))
    .orderBy(desc(activities.createdAt))
    .limit(limit);
}
