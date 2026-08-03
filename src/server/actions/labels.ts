'use server';

import { revalidatePath } from 'next/cache';

import { assertCan, requireWorkspaceOrThrow } from '@/lib/auth';
import { AppError, actionFailure, actionSuccess, type ActionResult } from '@/lib/errors';
import { fieldErrorsFrom, labelSchema } from '@/lib/validation';
import { createLabel, deleteLabel, reorderLabels, updateLabel } from '@/server/services/labels';
import type { LabelKind } from '@/lib/db/schema';

/**
 * Managing a workspace's statuses and categories.
 *
 * Gated on `project.update` rather than a capability of its own: changing the
 * vocabulary reshapes every board and filter in the workspace, so it belongs
 * with the people who configure projects, not with everyone who can triage.
 */

function formValue(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

export async function createLabelAction(
  kind: LabelKind,
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const context = await requireWorkspaceOrThrow();
    assertCan(context.role, 'project.update');

    const parsed = labelSchema.safeParse({
      label: formValue(formData, 'label'),
      tone: formValue(formData, 'tone') || 'neutral',
      lifecycle: formValue(formData, 'lifecycle') || 'active',
    });

    if (!parsed.success) {
      throw AppError.validation('Please check the form.', fieldErrorsFrom(parsed.error));
    }

    await createLabel(context.workspaceId, kind, parsed.data);
    revalidatePath('/dashboard/settings');

    return actionSuccess();
  } catch (error) {
    return actionFailure(error);
  }
}

export async function updateLabelAction(
  labelId: string,
  input: { label: string; tone: string; lifecycle: string },
): Promise<ActionResult> {
  try {
    const context = await requireWorkspaceOrThrow();
    assertCan(context.role, 'project.update');

    const parsed = labelSchema.safeParse(input);
    if (!parsed.success) {
      throw AppError.validation('Please check the form.', fieldErrorsFrom(parsed.error));
    }

    await updateLabel(context.workspaceId, labelId, parsed.data);
    revalidatePath('/dashboard/settings');

    return actionSuccess();
  } catch (error) {
    return actionFailure(error);
  }
}

export async function deleteLabelAction(
  labelId: string,
  reassignToKey: string,
): Promise<ActionResult> {
  try {
    const context = await requireWorkspaceOrThrow();
    assertCan(context.role, 'project.update');

    await deleteLabel(context.workspaceId, labelId, reassignToKey);

    // Everything that renders a label has to be refetched, not just settings:
    // items were just moved onto a different one.
    revalidatePath('/dashboard', 'layout');

    return actionSuccess();
  } catch (error) {
    return actionFailure(error);
  }
}

export async function reorderLabelsAction(
  kind: LabelKind,
  orderedIds: string[],
): Promise<ActionResult> {
  try {
    const context = await requireWorkspaceOrThrow();
    assertCan(context.role, 'project.update');

    await reorderLabels(context.workspaceId, kind, orderedIds);
    revalidatePath('/dashboard', 'layout');

    return actionSuccess();
  } catch (error) {
    return actionFailure(error);
  }
}
