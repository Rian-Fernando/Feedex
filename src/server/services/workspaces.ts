import 'server-only';

import { and, eq } from 'drizzle-orm';
import type { z } from 'zod';

import { getDb, type Database } from '@/lib/db';
import {
  users,
  workspaceMembers,
  workspaces,
  type Workspace,
  type WorkspaceRole,
} from '@/lib/db/schema';
import { createId, ID_PREFIX, slugify, uniquifySlug } from '@/lib/ids';
import { AppError } from '@/lib/errors';
import type { updateWorkspaceSchema } from '@/lib/validation';
import { recordActivity } from './activity';

/**
 * Workspaces are the tenancy boundary. Every other resource hangs off one, and
 * no query in the application reaches data without a workspace id in scope.
 */

export async function createWorkspace(
  input: { name: string; ownerId: string },
  tx?: Database,
): Promise<Workspace> {
  const db = tx ?? (await getDb());
  const id = createId(ID_PREFIX.workspace);
  const slug = await uniqueWorkspaceSlug(db, slugify(input.name) || 'workspace');

  const inserted = await db
    .insert(workspaces)
    .values({ id, name: input.name, slug, settings: {} })
    .returning();

  const workspace = inserted[0];
  if (!workspace) throw new Error('Failed to create workspace.');

  await db.insert(workspaceMembers).values({
    workspaceId: workspace.id,
    userId: input.ownerId,
    role: 'owner',
  });

  await recordActivity(
    {
      workspaceId: workspace.id,
      actorId: input.ownerId,
      action: 'workspace.created',
      targetType: 'workspace',
      targetId: workspace.id,
      metadata: { name: workspace.name },
    },
    db,
  );

  return workspace;
}

async function uniqueWorkspaceSlug(db: Database, base: string): Promise<string> {
  const existing = await db
    .select({ slug: workspaces.slug })
    .from(workspaces)
    .where(eq(workspaces.slug, base))
    .limit(1);

  return existing.length === 0 ? base : uniquifySlug(base);
}

export async function getWorkspace(workspaceId: string): Promise<Workspace | null> {
  const db = await getDb();
  const rows = await db.select().from(workspaces).where(eq(workspaces.id, workspaceId)).limit(1);
  return rows[0] ?? null;
}

export async function updateWorkspace(
  workspaceId: string,
  actorId: string,
  input: z.infer<typeof updateWorkspaceSchema>,
): Promise<Workspace> {
  const db = await getDb();
  const current = await getWorkspace(workspaceId);
  if (!current) throw AppError.notFound('Workspace not found.');

  const rows = await db
    .update(workspaces)
    .set({
      name: input.name,
      settings: {
        ...current.settings,
        defaultPriority: input.defaultPriority ?? current.settings.defaultPriority,
        defaultEnvironment: input.defaultEnvironment ?? current.settings.defaultEnvironment,
      },
      updatedAt: new Date(),
    })
    .where(eq(workspaces.id, workspaceId))
    .returning();

  const workspace = rows[0];
  if (!workspace) throw AppError.notFound('Workspace not found.');

  void actorId;
  return workspace;
}

export interface WorkspaceMemberView {
  userId: string;
  name: string;
  email: string;
  role: WorkspaceRole;
  joinedAt: Date;
}

export async function listMembers(workspaceId: string): Promise<WorkspaceMemberView[]> {
  const db = await getDb();

  return db
    .select({
      userId: users.id,
      name: users.name,
      email: users.email,
      role: workspaceMembers.role,
      joinedAt: workspaceMembers.createdAt,
    })
    .from(workspaceMembers)
    .innerJoin(users, eq(workspaceMembers.userId, users.id))
    .where(eq(workspaceMembers.workspaceId, workspaceId))
    .orderBy(workspaceMembers.createdAt);
}

/** Every workspace the user belongs to, for the workspace switcher. */
export async function listUserWorkspaces(
  userId: string,
): Promise<Array<{ id: string; name: string; slug: string; role: WorkspaceRole }>> {
  const db = await getDb();

  return db
    .select({
      id: workspaces.id,
      name: workspaces.name,
      slug: workspaces.slug,
      role: workspaceMembers.role,
    })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
    .where(eq(workspaceMembers.userId, userId))
    .orderBy(workspaces.createdAt);
}

/**
 * Deletes a workspace and, by cascade, every project, feedback item, key, and
 * activity entry inside it.
 */
export async function deleteWorkspace(workspaceId: string, actorId: string): Promise<void> {
  const db = await getDb();

  const owners = await db
    .select({ userId: workspaceMembers.userId })
    .from(workspaceMembers)
    .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.role, 'owner')));

  if (!owners.some((owner) => owner.userId === actorId)) {
    throw AppError.forbidden('Only the workspace owner can delete a workspace.');
  }

  await db.delete(workspaces).where(eq(workspaces.id, workspaceId));
}
