'use server';

import { revalidatePath } from 'next/cache';

import { assertCan, requireWorkspaceOrThrow } from '@/lib/auth';
import { actionFailure, actionSuccess, type ActionResult } from '@/lib/errors';
import { mergeFeedback, unmergeFeedback } from '@/server/services/feedback';

/** Merging is a triage decision, so it sits behind the same capability. */

export async function mergeFeedbackAction(
  duplicateId: string,
  canonicalId: string,
): Promise<ActionResult> {
  try {
    const context = await requireWorkspaceOrThrow();
    assertCan(context.role, 'feedback.update');

    await mergeFeedback(context.workspaceId, duplicateId, canonicalId);

    revalidatePath('/dashboard/feedback');
    revalidatePath(`/dashboard/feedback/${duplicateId}`);
    revalidatePath(`/dashboard/feedback/${canonicalId}`);

    return actionSuccess();
  } catch (error) {
    return actionFailure(error);
  }
}

export async function unmergeFeedbackAction(feedbackId: string): Promise<ActionResult> {
  try {
    const context = await requireWorkspaceOrThrow();
    assertCan(context.role, 'feedback.update');

    await unmergeFeedback(context.workspaceId, feedbackId);

    revalidatePath('/dashboard/feedback');
    revalidatePath(`/dashboard/feedback/${feedbackId}`);

    return actionSuccess();
  } catch (error) {
    return actionFailure(error);
  }
}
