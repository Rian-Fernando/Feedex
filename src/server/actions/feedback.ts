'use server';

import { revalidatePath } from 'next/cache';

import { actionFailure, actionSuccess, AppError, type ActionResult } from '@/lib/errors';
import { createNoteSchema, fieldErrorsFrom, updateFeedbackSchema } from '@/lib/validation';
import { assertCan, requireWorkspaceOrThrow } from '@/lib/auth';
import { recordActivity } from '@/server/services/activity';
import {
  createNote,
  deleteFeedback,
  getFeedback,
  updateFeedback,
} from '@/server/services/feedback';
import type { FeedbackPriority, FeedbackStatus } from '@/lib/db/schema';

/** Feedback triage actions. */

export async function updateFeedbackAction(
  feedbackId: string,
  input: {
    status?: FeedbackStatus;
    priority?: FeedbackPriority;
    category?: string;
    assignedToId?: string | null;
    tags?: string[];
    title?: string;
  },
): Promise<ActionResult> {
  try {
    const context = await requireWorkspaceOrThrow();
    assertCan(context.role, 'feedback.update');

    const parsed = updateFeedbackSchema.safeParse(input);
    if (!parsed.success) {
      throw AppError.validation('That change is not valid.', fieldErrorsFrom(parsed.error));
    }

    const before = await getFeedback(context.workspaceId, feedbackId);
    if (!before) throw AppError.notFound('Feedback not found.');

    await updateFeedback(context.workspaceId, feedbackId, parsed.data);

    // Record only the dimensions that actually changed, so the timeline stays
    // readable instead of logging a generic "updated" for every edit.
    if (parsed.data.status && parsed.data.status !== before.status) {
      await recordActivity({
        workspaceId: context.workspaceId,
        actorId: context.user.id,
        action: 'feedback.status_changed',
        targetType: 'feedback',
        targetId: feedbackId,
        metadata: { from: before.status, to: parsed.data.status, title: before.title },
      });
    }

    if (parsed.data.priority && parsed.data.priority !== before.priority) {
      await recordActivity({
        workspaceId: context.workspaceId,
        actorId: context.user.id,
        action: 'feedback.priority_changed',
        targetType: 'feedback',
        targetId: feedbackId,
        metadata: { from: before.priority, to: parsed.data.priority, title: before.title },
      });
    }

    if (parsed.data.category && parsed.data.category !== before.category) {
      await recordActivity({
        workspaceId: context.workspaceId,
        actorId: context.user.id,
        action: 'feedback.category_changed',
        targetType: 'feedback',
        targetId: feedbackId,
        metadata: { from: before.category, to: parsed.data.category, title: before.title },
      });
    }

    revalidatePath('/dashboard/feedback');
    revalidatePath(`/dashboard/feedback/${feedbackId}`);
    revalidatePath('/dashboard');

    return actionSuccess();
  } catch (error) {
    return actionFailure(error);
  }
}

export async function createNoteAction(
  feedbackId: string,
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const context = await requireWorkspaceOrThrow();
    assertCan(context.role, 'note.create');

    const body = formData.get('body');
    const parsed = createNoteSchema.safeParse({ body: typeof body === 'string' ? body : '' });

    if (!parsed.success) {
      throw AppError.validation('Write something first.', fieldErrorsFrom(parsed.error));
    }

    await createNote(context.workspaceId, feedbackId, context.user.id, parsed.data.body);

    await recordActivity({
      workspaceId: context.workspaceId,
      actorId: context.user.id,
      action: 'note.created',
      targetType: 'feedback',
      targetId: feedbackId,
    });

    revalidatePath(`/dashboard/feedback/${feedbackId}`);
    return actionSuccess();
  } catch (error) {
    return actionFailure(error);
  }
}

export async function deleteFeedbackAction(feedbackId: string): Promise<ActionResult> {
  try {
    const context = await requireWorkspaceOrThrow();
    assertCan(context.role, 'feedback.delete');

    const existing = await getFeedback(context.workspaceId, feedbackId);
    if (!existing) throw AppError.notFound('Feedback not found.');

    await deleteFeedback(context.workspaceId, feedbackId);

    await recordActivity({
      workspaceId: context.workspaceId,
      actorId: context.user.id,
      action: 'feedback.deleted',
      targetType: 'feedback',
      targetId: feedbackId,
      metadata: { title: existing.title },
    });

    revalidatePath('/dashboard/feedback');
    revalidatePath('/dashboard');

    return actionSuccess();
  } catch (error) {
    return actionFailure(error);
  }
}
