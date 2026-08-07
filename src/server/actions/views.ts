'use server';

import { revalidatePath } from 'next/cache';

import { requireWorkspaceOrThrow } from '@/lib/auth';
import { AppError, actionFailure, actionSuccess, type ActionResult } from '@/lib/errors';
import { createView, deleteView } from '@/server/services/views';

/**
 * Saved views.
 *
 * No capability check: a view is a personal bookmark scoped to the acting
 * user, so anyone who can see the workspace can keep their own.
 */

export async function createViewAction(name: string, query: string): Promise<ActionResult> {
  try {
    const context = await requireWorkspaceOrThrow();

    const trimmed = name.trim();
    if (!trimmed) throw AppError.validation('Give the view a name.');
    if (trimmed.length > 60) throw AppError.validation('That name is too long.');

    await createView({
      workspaceId: context.workspaceId,
      userId: context.user.id,
      name: trimmed,
      query,
    });

    revalidatePath('/dashboard/feedback');
    return actionSuccess();
  } catch (error) {
    return actionFailure(error);
  }
}

export async function deleteViewAction(viewId: string): Promise<ActionResult> {
  try {
    const context = await requireWorkspaceOrThrow();

    await deleteView(context.workspaceId, context.user.id, viewId);
    revalidatePath('/dashboard/feedback');

    return actionSuccess();
  } catch (error) {
    return actionFailure(error);
  }
}
