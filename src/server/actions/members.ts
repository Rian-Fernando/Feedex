'use server';

import { revalidatePath } from 'next/cache';

import { headers } from 'next/headers';

import { assertCan, requireWorkspaceOrThrow } from '@/lib/auth';
import { RATE_LIMITS, consume } from '@/lib/rate-limit';
import { AppError, actionFailure, actionSuccess, type ActionResult } from '@/lib/errors';
import { emailSchema } from '@/lib/validation';
import { absoluteUrl } from '@/config/site';
import {
  createInvitation,
  removeMember,
  revokeInvitation,
  updateMemberRole,
} from '@/server/services/workspaces';
import { recordActivity } from '@/server/services/activity';
import type { WorkspaceRole } from '@/lib/db/schema';

/**
 * Workspace membership.
 *
 * All gated on `member.manage`, which is owners and admins. A member who can
 * triage feedback has no business changing who else can see it.
 */

const ASSIGNABLE_ROLES: WorkspaceRole[] = ['owner', 'admin', 'member', 'viewer'];

/** Best-effort client IP, for the limits that are per person rather than per tenant. */
async function clientKey(prefix: string): Promise<string> {
  const headerList = await headers();
  const ip =
    headerList.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    headerList.get('x-real-ip') ??
    'unknown';
  return `${prefix}:${ip}`;
}

function parseRole(value: string): WorkspaceRole {
  if (!ASSIGNABLE_ROLES.includes(value as WorkspaceRole)) {
    throw AppError.validation('That is not a valid role.');
  }
  return value as WorkspaceRole;
}

export async function inviteMemberAction(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult<{ url: string; email: string | null }>> {
  try {
    const context = await requireWorkspaceOrThrow();
    assertCan(context.role, 'member.manage');

    // Per workspace, not per IP: this bounds what a compromised admin session
    // can mint, which is the case that matters here.
    const limit = await consume({
      key: `invite:${context.workspaceId}`,
      ...RATE_LIMITS.invite,
    });

    if (!limit.allowed) {
      throw AppError.rateLimited('Too many invitations created. Try again later.');
    }

    const rawEmail = String(formData.get('email') ?? '').trim();
    const role = parseRole(String(formData.get('role') ?? 'member'));

    // Only an owner can mint another owner; otherwise an admin could quietly
    // promote themselves by inviting a second account.
    if (role === 'owner' && context.role !== 'owner') {
      throw AppError.forbidden('Only an owner can invite another owner.');
    }

    let email: string | null = null;
    if (rawEmail) {
      const parsed = emailSchema.safeParse(rawEmail);
      if (!parsed.success) throw AppError.validation('Enter a valid email address.');
      email = parsed.data;
    }

    const { token } = await createInvitation({
      workspaceId: context.workspaceId,
      invitedById: context.user.id,
      role,
      email,
    });

    await recordActivity({
      workspaceId: context.workspaceId,
      actorId: context.user.id,
      action: 'member.invited',
      targetType: 'workspace',
      targetId: context.workspaceId,
      metadata: { role, email: email ?? 'anyone with the link' },
    });

    revalidatePath('/dashboard/settings');

    // The raw token is returned exactly once — only its hash is stored — so
    // the UI has to show the link now or it is gone.
    return actionSuccess({ url: absoluteUrl(`/invite/${token}`), email });
  } catch (error) {
    return actionFailure(error);
  }
}

export async function revokeInvitationAction(invitationId: string): Promise<ActionResult> {
  try {
    const context = await requireWorkspaceOrThrow();
    assertCan(context.role, 'member.manage');

    await revokeInvitation(context.workspaceId, invitationId);
    revalidatePath('/dashboard/settings');

    return actionSuccess();
  } catch (error) {
    return actionFailure(error);
  }
}

export async function updateMemberRoleAction(userId: string, role: string): Promise<ActionResult> {
  try {
    const context = await requireWorkspaceOrThrow();
    assertCan(context.role, 'member.manage');

    const next = parseRole(role);

    if (next === 'owner' && context.role !== 'owner') {
      throw AppError.forbidden('Only an owner can promote someone to owner.');
    }

    await updateMemberRole(context.workspaceId, userId, next);
    revalidatePath('/dashboard/settings');

    return actionSuccess();
  } catch (error) {
    return actionFailure(error);
  }
}

export async function removeMemberAction(userId: string): Promise<ActionResult> {
  try {
    const context = await requireWorkspaceOrThrow();
    assertCan(context.role, 'member.manage');

    // Leaving is a different operation with different consequences (you lose
    // your own access), so it is not quietly folded into this one.
    if (userId === context.user.id) {
      throw AppError.validation('You cannot remove yourself. Ask another owner to do it.');
    }

    await removeMember(context.workspaceId, userId);

    await recordActivity({
      workspaceId: context.workspaceId,
      actorId: context.user.id,
      action: 'member.removed',
      targetType: 'workspace',
      targetId: context.workspaceId,
      metadata: { userId },
    });

    revalidatePath('/dashboard/settings');
    return actionSuccess();
  } catch (error) {
    return actionFailure(error);
  }
}

export async function acceptInvitationAction(token: string): Promise<ActionResult<string>> {
  try {
    const { requireUserOrThrow, setActiveWorkspace } = await import('@/lib/auth');
    const { acceptInvitation } = await import('@/server/services/workspaces');

    const user = await requireUserOrThrow();

    const limit = await consume({
      key: await clientKey('invite-accept'),
      ...RATE_LIMITS.inviteAccept,
    });

    if (!limit.allowed) {
      throw AppError.rateLimited('Too many attempts. Try again later.');
    }

    const { workspaceId } = await acceptInvitation(token, { id: user.id, email: user.email });

    // Land them in the workspace they just joined rather than whichever one
    // happened to be active.
    await setActiveWorkspace(workspaceId);
    revalidatePath('/dashboard', 'layout');

    return actionSuccess(workspaceId);
  } catch (error) {
    return actionFailure(error);
  }
}
