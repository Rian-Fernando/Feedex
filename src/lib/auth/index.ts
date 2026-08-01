import 'server-only';

import { cache } from 'react';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { and, eq } from 'drizzle-orm';

import { getDb } from '@/lib/db';
import { workspaceMembers, workspaces, type User, type WorkspaceRole } from '@/lib/db/schema';
import { AppError } from '@/lib/errors';
import { getSession } from './session';

export * from './session';
export * from './password';

const ACTIVE_WORKSPACE_COOKIE = 'feedex_workspace';

/**
 * Per-request memoised session lookup.
 *
 * A dashboard page typically resolves the user in the layout, the page, and
 * several components. `cache` collapses those into a single query per request.
 */
export const currentUser = cache(async (): Promise<User | null> => {
  const session = await getSession();
  return session?.user ?? null;
});

/** Redirects to sign-in when unauthenticated. For use in pages and layouts. */
export async function requireUser(returnTo?: string): Promise<User> {
  const user = await currentUser();
  if (!user) {
    const target = returnTo ? `/login?next=${encodeURIComponent(returnTo)}` : '/login';
    redirect(target);
  }
  return user;
}

/** Throws instead of redirecting. For use in server actions and route handlers. */
export async function requireUserOrThrow(): Promise<User> {
  const user = await currentUser();
  if (!user) throw AppError.unauthorized();
  return user;
}

export interface WorkspaceContext {
  user: User;
  workspaceId: string;
  workspaceSlug: string;
  workspaceName: string;
  role: WorkspaceRole;
}

/**
 * Role capability matrix.
 *
 * Kept as data rather than scattered `if (role === 'owner')` checks so that
 * adding a role or a permission is a single-table edit.
 */
const CAPABILITIES = {
  'workspace.update': ['owner', 'admin'],
  'workspace.delete': ['owner'],
  'member.manage': ['owner', 'admin'],
  'project.create': ['owner', 'admin', 'member'],
  'project.update': ['owner', 'admin', 'member'],
  'project.delete': ['owner', 'admin'],
  'apikey.manage': ['owner', 'admin', 'member'],
  'feedback.update': ['owner', 'admin', 'member'],
  'feedback.delete': ['owner', 'admin'],
  'note.create': ['owner', 'admin', 'member'],
} as const satisfies Record<string, readonly WorkspaceRole[]>;

export type Capability = keyof typeof CAPABILITIES;

export function can(role: WorkspaceRole, capability: Capability): boolean {
  return (CAPABILITIES[capability] as readonly WorkspaceRole[]).includes(role);
}

export function assertCan(role: WorkspaceRole, capability: Capability): void {
  if (!can(role, capability)) {
    throw AppError.forbidden('Your role does not permit that action.');
  }
}

/**
 * Resolves the workspace the dashboard should operate on.
 *
 * Preference order: the `feedex_workspace` cookie if the user is still a member
 * of it, otherwise their first membership. Individual resource pages authorise
 * against the resource's own workspace instead, so a stale cookie can never
 * grant or deny access to a specific record.
 */
export const activeWorkspace = cache(async (): Promise<WorkspaceContext | null> => {
  const user = await currentUser();
  if (!user) return null;

  const db = await getDb();
  const memberships = await db
    .select({
      workspaceId: workspaces.id,
      workspaceSlug: workspaces.slug,
      workspaceName: workspaces.name,
      role: workspaceMembers.role,
    })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
    .where(eq(workspaceMembers.userId, user.id))
    .orderBy(workspaces.createdAt);

  if (memberships.length === 0) return null;

  const store = await cookies();
  const preferred = store.get(ACTIVE_WORKSPACE_COOKIE)?.value;
  const selected = memberships.find((m) => m.workspaceId === preferred) ?? memberships[0]!;

  return { user, ...selected };
});

export async function requireWorkspace(): Promise<WorkspaceContext> {
  const user = await requireUser();
  const context = await activeWorkspace();

  if (!context) {
    // A user with no memberships is an inconsistent state (registration always
    // creates one). Send them somewhere that can repair it rather than 500.
    redirect('/onboarding');
  }

  void user;
  return context;
}

export async function requireWorkspaceOrThrow(): Promise<WorkspaceContext> {
  await requireUserOrThrow();
  const context = await activeWorkspace();
  if (!context) throw AppError.forbidden('No workspace is available for this account.');
  return context;
}

/**
 * Authorises a user against a specific workspace, regardless of which one is
 * currently active. Used by resource pages so that deep links work.
 */
export async function requireMembership(workspaceId: string): Promise<WorkspaceContext> {
  const user = await requireUserOrThrow();
  const db = await getDb();

  const rows = await db
    .select({
      workspaceId: workspaces.id,
      workspaceSlug: workspaces.slug,
      workspaceName: workspaces.name,
      role: workspaceMembers.role,
    })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
    .where(and(eq(workspaceMembers.userId, user.id), eq(workspaceMembers.workspaceId, workspaceId)))
    .limit(1);

  const row = rows[0];
  if (!row) throw AppError.notFound();

  return { user, ...row };
}

export async function setActiveWorkspace(workspaceId: string): Promise<void> {
  const store = await cookies();
  store.set(ACTIVE_WORKSPACE_COOKIE, workspaceId, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  });
}
