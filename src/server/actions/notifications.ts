'use server';

import { revalidatePath } from 'next/cache';

import { requireWorkspaceOrThrow } from '@/lib/auth';
import { actionFailure, actionSuccess, type ActionResult } from '@/lib/errors';
import { updateNotificationPreferences } from '@/server/services/notifications';
import type { NotificationPreferences } from '@/lib/db/schema';

/**
 * A member's own notification settings.
 *
 * No capability check: these govern what lands in the acting user's inbox and
 * nobody else's, so anyone in the workspace may set their own.
 */
export async function updateNotificationsAction(
  input: NotificationPreferences,
): Promise<ActionResult> {
  try {
    const context = await requireWorkspaceOrThrow();

    await updateNotificationPreferences(context.workspaceId, context.user.id, {
      newFeedback: Boolean(input.newFeedback),
      minPriority: input.minPriority,
    });

    revalidatePath('/dashboard/settings');
    return actionSuccess();
  } catch (error) {
    return actionFailure(error);
  }
}
