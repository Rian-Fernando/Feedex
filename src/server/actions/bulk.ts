'use server';

import { revalidatePath } from 'next/cache';

import { assertCan, requireWorkspaceOrThrow } from '@/lib/auth';
import { AppError, actionFailure, actionSuccess, type ActionResult } from '@/lib/errors';
import { bulkDeleteFeedback, bulkUpdateFeedback } from '@/server/services/feedback';
import { feedbackPriority } from '@/lib/db/schema';
import { recordActivity } from '@/server/services/activity';

/**
 * Bulk triage.
 *
 * The selection arrives from the client, so it is untrusted: the service scopes
 * every statement to the caller's workspace rather than checking the ids first.
 */

/** Bounded so one request cannot be turned into an unbounded write. */
const MAX_SELECTION = 200;

function assertSelection(ids: string[]): void {
  if (ids.length === 0) throw AppError.validation('Nothing selected.');
  if (ids.length > MAX_SELECTION) {
    throw AppError.validation(`Select at most ${MAX_SELECTION} items at a time.`);
  }
}

export async function bulkUpdateAction(
  ids: string[],
  input: { status?: string; priority?: string; category?: string },
): Promise<ActionResult<number>> {
  try {
    const context = await requireWorkspaceOrThrow();
    assertCan(context.role, 'feedback.update');
    assertSelection(ids);

    // Priority is still a fixed enum, unlike status and category, so it is
    // narrowed here rather than trusted from the client.
    if (
      input.priority &&
      !(feedbackPriority.enumValues as readonly string[]).includes(input.priority)
    ) {
      throw AppError.validation('That is not a valid priority.');
    }

    const changed = await bulkUpdateFeedback(context.workspaceId, ids, {
      status: input.status,
      category: input.category,
      priority: input.priority as (typeof feedbackPriority.enumValues)[number] | undefined,
    });

    await recordActivity({
      workspaceId: context.workspaceId,
      actorId: context.user.id,
      action: 'feedback.status_changed',
      targetType: 'feedback',
      targetId: ids[0]!,
      metadata: { bulk: String(changed), ...input },
    });

    revalidatePath('/dashboard/feedback');
    return actionSuccess(changed);
  } catch (error) {
    return actionFailure(error);
  }
}

export async function bulkDeleteAction(ids: string[]): Promise<ActionResult<number>> {
  try {
    const context = await requireWorkspaceOrThrow();
    // Deleting is a stronger capability than triaging, and stays that way in
    // bulk — this is the one action here that cannot be undone.
    assertCan(context.role, 'feedback.delete');
    assertSelection(ids);

    const removed = await bulkDeleteFeedback(context.workspaceId, ids);

    revalidatePath('/dashboard/feedback');
    return actionSuccess(removed);
  } catch (error) {
    return actionFailure(error);
  }
}
