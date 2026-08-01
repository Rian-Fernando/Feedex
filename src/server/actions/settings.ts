'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { actionFailure, actionSuccess, AppError, type ActionResult } from '@/lib/errors';
import {
  changePasswordSchema,
  fieldErrorsFrom,
  updateProfileSchema,
  updateWorkspaceSchema,
} from '@/lib/validation';
import {
  assertCan,
  destroyAllSessions,
  requireUserOrThrow,
  requireWorkspaceOrThrow,
  setActiveWorkspace,
} from '@/lib/auth';
import { changePassword, updatePreferences, updateProfile } from '@/server/services/accounts';
import { deleteWorkspace, updateWorkspace } from '@/server/services/workspaces';

/** Settings mutations: profile, credentials, appearance, and workspace. */

function formValue(data: FormData, key: string): string {
  const value = data.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

export async function updateProfileAction(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const user = await requireUserOrThrow();

    const parsed = updateProfileSchema.safeParse({
      name: formValue(formData, 'name'),
      email: formValue(formData, 'email'),
    });

    if (!parsed.success) {
      throw AppError.validation('Please check the form.', fieldErrorsFrom(parsed.error));
    }

    await updateProfile(user.id, parsed.data);
    revalidatePath('/dashboard/settings');

    return actionSuccess();
  } catch (error) {
    return actionFailure(error);
  }
}

export async function changePasswordAction(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const user = await requireUserOrThrow();

    const parsed = changePasswordSchema.safeParse({
      currentPassword: formValue(formData, 'currentPassword'),
      newPassword: formValue(formData, 'newPassword'),
      confirmPassword: formValue(formData, 'confirmPassword'),
    });

    if (!parsed.success) {
      throw AppError.validation('Please check the form.', fieldErrorsFrom(parsed.error));
    }

    await changePassword(user.id, parsed.data.currentPassword, parsed.data.newPassword);

    // A password change invalidates every other session, which is the point of
    // changing it. The current session is re-established on the next request.
    await destroyAllSessions(user.id);

    return actionSuccess();
  } catch (error) {
    return actionFailure(error);
  }
}

export async function updateAppearanceAction(
  theme: 'light' | 'dark' | 'system',
  density: 'comfortable' | 'compact',
): Promise<ActionResult> {
  try {
    const user = await requireUserOrThrow();
    await updatePreferences(user.id, { theme, density });
    revalidatePath('/dashboard/settings');
    return actionSuccess();
  } catch (error) {
    return actionFailure(error);
  }
}

export async function updateWorkspaceAction(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const context = await requireWorkspaceOrThrow();
    assertCan(context.role, 'workspace.update');

    const parsed = updateWorkspaceSchema.safeParse({
      name: formValue(formData, 'name'),
      defaultPriority: formValue(formData, 'defaultPriority') || undefined,
      defaultEnvironment: formValue(formData, 'defaultEnvironment') || undefined,
    });

    if (!parsed.success) {
      throw AppError.validation('Please check the form.', fieldErrorsFrom(parsed.error));
    }

    await updateWorkspace(context.workspaceId, context.user.id, parsed.data);
    revalidatePath('/dashboard/settings');
    revalidatePath('/dashboard');

    return actionSuccess();
  } catch (error) {
    return actionFailure(error);
  }
}

export async function switchWorkspaceAction(workspaceId: string): Promise<void> {
  await requireUserOrThrow();
  await setActiveWorkspace(workspaceId);
  redirect('/dashboard');
}

export async function deleteWorkspaceAction(confirmation: string): Promise<ActionResult> {
  try {
    const context = await requireWorkspaceOrThrow();
    assertCan(context.role, 'workspace.delete');

    // Typing the workspace name is the guard against an accidental cascade.
    if (confirmation !== context.workspaceName) {
      throw AppError.validation('The workspace name does not match.');
    }

    await deleteWorkspace(context.workspaceId, context.user.id);
    return actionSuccess();
  } catch (error) {
    return actionFailure(error);
  }
}
