'use server';

import { revalidatePath } from 'next/cache';

import { actionFailure, actionSuccess, AppError, type ActionResult } from '@/lib/errors';
import {
  createProjectSchema,
  fieldErrorsFrom,
  updateProjectSchema,
  widgetSettingsSchema,
} from '@/lib/validation';
import { assertCan, requireWorkspaceOrThrow } from '@/lib/auth';
import {
  createProject,
  deleteProject,
  revokeApiKey,
  rotateApiKey,
  updateProject,
  updateWidgetSettings,
} from '@/server/services/projects';

/** Project and API key mutations, all scoped to the caller's active workspace. */

function formValue(data: FormData, key: string): string {
  const value = data.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

export interface CreatedProject {
  projectId: string;
  publicKey: string;
  secretKey: string;
}

export async function createProjectAction(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult<CreatedProject>> {
  try {
    const context = await requireWorkspaceOrThrow();
    assertCan(context.role, 'project.create');

    const parsed = createProjectSchema.safeParse({
      name: formValue(formData, 'name'),
      description: formValue(formData, 'description') || undefined,
      domain: formValue(formData, 'domain'),
      environment: formValue(formData, 'environment') || 'production',
      color: formValue(formData, 'color') || '#B58BF9',
    });

    if (!parsed.success) {
      throw AppError.validation('Please check the form.', fieldErrorsFrom(parsed.error));
    }

    const result = await createProject(context.workspaceId, context.user.id, parsed.data);

    revalidatePath('/dashboard/projects');
    revalidatePath('/dashboard');

    return actionSuccess({
      projectId: result.project.id,
      publicKey: result.publicKey,
      secretKey: result.secretKey,
    });
  } catch (error) {
    return actionFailure(error);
  }
}

export async function updateProjectAction(
  projectId: string,
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const context = await requireWorkspaceOrThrow();
    assertCan(context.role, 'project.update');

    const parsed = updateProjectSchema.safeParse({
      name: formValue(formData, 'name'),
      description: formValue(formData, 'description') || undefined,
      domain: formValue(formData, 'domain'),
      environment: formValue(formData, 'environment') || 'production',
      color: formValue(formData, 'color') || '#B58BF9',
      status: formValue(formData, 'status') || undefined,
    });

    if (!parsed.success) {
      throw AppError.validation('Please check the form.', fieldErrorsFrom(parsed.error));
    }

    await updateProject(context.workspaceId, context.user.id, projectId, parsed.data);

    revalidatePath('/dashboard/projects');
    revalidatePath(`/dashboard/projects/${projectId}`);

    return actionSuccess();
  } catch (error) {
    return actionFailure(error);
  }
}

export async function updateWidgetSettingsAction(
  projectId: string,
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const context = await requireWorkspaceOrThrow();
    assertCan(context.role, 'project.update');

    const categories = formData
      .getAll('categories')
      .filter((v): v is string => typeof v === 'string');

    const parsed = widgetSettingsSchema.safeParse({
      position: formValue(formData, 'position') || 'bottom-right',
      accentColor: formValue(formData, 'accentColor') || '#B58BF9',
      buttonLabel: formValue(formData, 'buttonLabel') || 'Feedback',
      title: formValue(formData, 'title') || 'Send feedback',
      description:
        formValue(formData, 'description') || 'Found a bug or have an idea? Let us know.',
      successMessage:
        formValue(formData, 'successMessage') || 'Thanks — your feedback has been received.',
      launcherIcon: formValue(formData, 'launcherIcon') || 'chat',
      requireEmail: formData.get('requireEmail') === 'on',
      attachmentsEnabled: formData.get('attachmentsEnabled') === 'on',
      theme: formValue(formData, 'theme') || 'auto',
      categories: categories.length > 0 ? categories : undefined,
    });

    if (!parsed.success) {
      throw AppError.validation('Please check the form.', fieldErrorsFrom(parsed.error));
    }

    await updateWidgetSettings(context.workspaceId, projectId, parsed.data);
    revalidatePath(`/dashboard/projects/${projectId}`);

    return actionSuccess();
  } catch (error) {
    return actionFailure(error);
  }
}

export async function deleteProjectAction(projectId: string): Promise<ActionResult> {
  try {
    const context = await requireWorkspaceOrThrow();
    assertCan(context.role, 'project.delete');

    await deleteProject(context.workspaceId, context.user.id, projectId);

    revalidatePath('/dashboard/projects');
    revalidatePath('/dashboard');

    return actionSuccess();
  } catch (error) {
    return actionFailure(error);
  }
}

export async function rotateKeyAction(
  projectId: string,
  type: 'public' | 'secret',
): Promise<ActionResult<{ token: string }>> {
  try {
    const context = await requireWorkspaceOrThrow();
    assertCan(context.role, 'apikey.manage');

    const result = await rotateApiKey(context.workspaceId, context.user.id, projectId, type);
    revalidatePath(`/dashboard/projects/${projectId}`);

    return actionSuccess(result);
  } catch (error) {
    return actionFailure(error);
  }
}

export async function revokeKeyAction(projectId: string, keyId: string): Promise<ActionResult> {
  try {
    const context = await requireWorkspaceOrThrow();
    assertCan(context.role, 'apikey.manage');

    await revokeApiKey(context.workspaceId, context.user.id, projectId, keyId);
    revalidatePath(`/dashboard/projects/${projectId}`);

    return actionSuccess();
  } catch (error) {
    return actionFailure(error);
  }
}
