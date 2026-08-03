import 'server-only';

import { createHash, randomBytes } from 'node:crypto';

import { and, eq, gt, isNull } from 'drizzle-orm';
import type { z } from 'zod';

import { getDb, type Database } from '@/lib/db';
import {
  users,
  workspaceInvitations,
  workspaceMembers,
  workspaces,
  type Workspace,
  type WorkspaceRole,
} from '@/lib/db/schema';
import { createId, ID_PREFIX, slugify, uniquifySlug } from '@/lib/ids';
import { seedWorkspaceLabels } from '@/server/services/labels';
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

  // Before anything can reference them: feedback rows carry label keys, so a
  // workspace without its vocabulary would have no valid status to ingest into.
  await seedWorkspaceLabels(workspace.id, db);

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

/* ------------------------------- Membership ------------------------------- */

/**
 * Changes a member's role.
 *
 * Refuses to leave the workspace without an owner. Demoting the last one would
 * strip the only account that can delete the workspace or manage billing, and
 * there would be nobody left with the authority to undo it.
 */
export async function updateMemberRole(
  workspaceId: string,
  userId: string,
  role: WorkspaceRole,
): Promise<void> {
  const db = await getDb();
  const members = await listMembers(workspaceId);

  const target = members.find((member) => member.userId === userId);
  if (!target) throw AppError.notFound('That person is not a member of this workspace.');

  if (target.role === 'owner' && role !== 'owner') {
    const owners = members.filter((member) => member.role === 'owner');
    if (owners.length <= 1) {
      throw AppError.validation(
        'A workspace needs at least one owner. Promote someone else first.',
      );
    }
  }

  await db
    .update(workspaceMembers)
    .set({ role })
    .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, userId)));
}

/** Removes a member, with the same last-owner protection. */
export async function removeMember(workspaceId: string, userId: string): Promise<void> {
  const db = await getDb();
  const members = await listMembers(workspaceId);

  const target = members.find((member) => member.userId === userId);
  if (!target) throw AppError.notFound('That person is not a member of this workspace.');

  if (target.role === 'owner') {
    const owners = members.filter((member) => member.role === 'owner');
    if (owners.length <= 1) {
      throw AppError.validation('A workspace needs at least one owner.');
    }
  }

  await db
    .delete(workspaceMembers)
    .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, userId)));
}

/* ------------------------------- Invitations ------------------------------ */

export interface InvitationView {
  id: string;
  email: string | null;
  role: WorkspaceRole;
  expiresAt: Date;
  createdAt: Date;
  invitedByName: string | null;
}

/** How long an invite link stays usable. */
const INVITE_TTL_DAYS = 7;

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Creates an invitation and returns the raw token exactly once.
 *
 * The token is not recoverable afterwards — only its hash is stored — so the
 * caller has to surface the link immediately, the same contract as a secret
 * API key.
 */
export async function createInvitation(input: {
  workspaceId: string;
  invitedById: string;
  role: WorkspaceRole;
  email?: string | null;
}): Promise<{ token: string; invitation: InvitationView }> {
  const db = await getDb();

  if (input.email) {
    const members = await listMembers(input.workspaceId);
    const normalised = input.email.toLowerCase();

    if (members.some((member) => member.email.toLowerCase() === normalised)) {
      throw AppError.conflict('That person is already a member of this workspace.');
    }
  }

  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);

  await db.insert(workspaceInvitations).values({
    id: hashToken(token),
    workspaceId: input.workspaceId,
    email: input.email?.toLowerCase() ?? null,
    role: input.role,
    invitedById: input.invitedById,
    expiresAt,
  });

  return {
    token,
    invitation: {
      id: hashToken(token),
      email: input.email?.toLowerCase() ?? null,
      role: input.role,
      expiresAt,
      createdAt: new Date(),
      invitedByName: null,
    },
  };
}

/** Invitations that have not been used and have not expired. */
export async function listInvitations(workspaceId: string): Promise<InvitationView[]> {
  const db = await getDb();

  return db
    .select({
      id: workspaceInvitations.id,
      email: workspaceInvitations.email,
      role: workspaceInvitations.role,
      expiresAt: workspaceInvitations.expiresAt,
      createdAt: workspaceInvitations.createdAt,
      invitedByName: users.name,
    })
    .from(workspaceInvitations)
    .leftJoin(users, eq(workspaceInvitations.invitedById, users.id))
    .where(
      and(
        eq(workspaceInvitations.workspaceId, workspaceId),
        isNull(workspaceInvitations.acceptedAt),
        gt(workspaceInvitations.expiresAt, new Date()),
      ),
    )
    .orderBy(workspaceInvitations.createdAt);
}

export async function revokeInvitation(workspaceId: string, invitationId: string): Promise<void> {
  const db = await getDb();

  await db
    .delete(workspaceInvitations)
    .where(
      and(
        eq(workspaceInvitations.workspaceId, workspaceId),
        eq(workspaceInvitations.id, invitationId),
      ),
    );
}

export interface InvitationPreview {
  workspaceId: string;
  workspaceName: string;
  role: WorkspaceRole;
  email: string | null;
}

/** Resolves a raw token to what it offers, without accepting it. */
export async function previewInvitation(token: string): Promise<InvitationPreview | null> {
  const db = await getDb();

  const rows = await db
    .select({
      workspaceId: workspaceInvitations.workspaceId,
      workspaceName: workspaces.name,
      role: workspaceInvitations.role,
      email: workspaceInvitations.email,
      expiresAt: workspaceInvitations.expiresAt,
      acceptedAt: workspaceInvitations.acceptedAt,
    })
    .from(workspaceInvitations)
    .innerJoin(workspaces, eq(workspaceInvitations.workspaceId, workspaces.id))
    .where(eq(workspaceInvitations.id, hashToken(token)))
    .limit(1);

  const row = rows[0];
  if (!row || row.acceptedAt || row.expiresAt < new Date()) return null;

  return {
    workspaceId: row.workspaceId,
    workspaceName: row.workspaceName,
    role: row.role,
    email: row.email,
  };
}

/**
 * Accepts an invitation on behalf of a signed-in user.
 *
 * The email restriction is enforced here rather than only in the UI: a link is
 * a bearer credential, and the whole point of naming an address is that
 * forwarding it to somebody else does not grant them access.
 */
export async function acceptInvitation(
  token: string,
  user: { id: string; email: string },
): Promise<{ workspaceId: string }> {
  const db = await getDb();
  const invitation = await previewInvitation(token);

  if (!invitation) {
    throw AppError.validation('That invitation has expired or has already been used.');
  }

  if (invitation.email && invitation.email !== user.email.toLowerCase()) {
    throw AppError.forbidden(`That invitation was issued to ${invitation.email}.`);
  }

  await db.transaction(async (tx) => {
    await tx
      .insert(workspaceMembers)
      .values({
        workspaceId: invitation.workspaceId,
        userId: user.id,
        role: invitation.role,
      })
      // Already a member: accepting again should be a no-op rather than an
      // error, and must never downgrade an existing role.
      .onConflictDoNothing();

    await tx
      .update(workspaceInvitations)
      .set({ acceptedAt: new Date(), acceptedById: user.id })
      .where(eq(workspaceInvitations.id, hashToken(token)));
  });

  return { workspaceId: invitation.workspaceId };
}
