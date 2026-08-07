'use server';

import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';

import { assertCan, requireWorkspaceOrThrow } from '@/lib/auth';
import { AppError, actionFailure, actionSuccess, type ActionResult } from '@/lib/errors';
import { getDb } from '@/lib/db';
import { feedback, projects } from '@/lib/db/schema';
import { requireProject } from '@/server/services/projects';
import { slugify } from '@/lib/ids';
import { absoluteUrl } from '@/config/site';

/**
 * Publishing controls.
 *
 * Two separate decisions, deliberately: turning a roadmap on, and putting an
 * item on it. Collapsing them into one switch is how a private queue ends up
 * public by accident.
 */

/**
 * Derives a globally unique public slug.
 *
 * Public URLs cannot be scoped to a workspace, so a name collision between two
 * tenants is expected rather than exceptional — hence the numeric suffix.
 */
async function uniquePublicSlug(name: string, projectId: string): Promise<string> {
  const db = await getDb();
  const base = slugify(name).slice(0, 60) || 'roadmap';

  for (let attempt = 0; attempt < 50; attempt += 1) {
    const candidate = attempt === 0 ? base : `${base}-${attempt + 1}`;

    const taken = await db
      .select({ id: projects.id })
      .from(projects)
      .where(eq(projects.publicSlug, candidate))
      .limit(1);

    if (!taken[0] || taken[0].id === projectId) return candidate;
  }

  throw AppError.conflict('Could not derive a unique public address for this project.');
}

export async function setRoadmapEnabledAction(
  projectId: string,
  enabled: boolean,
): Promise<ActionResult<string | null>> {
  try {
    const context = await requireWorkspaceOrThrow();
    assertCan(context.role, 'project.update');

    const project = await requireProject(context.workspaceId, projectId);
    const db = await getDb();

    // The slug is kept when a roadmap is switched off, so turning it back on
    // does not break links people have already shared.
    const publicSlug = project.publicSlug ?? (await uniquePublicSlug(project.name, projectId));

    await db
      .update(projects)
      .set({ roadmapEnabled: enabled, publicSlug, updatedAt: new Date() })
      .where(and(eq(projects.workspaceId, context.workspaceId), eq(projects.id, projectId)));

    revalidatePath(`/dashboard/projects/${projectId}`);
    revalidatePath(`/roadmap/${publicSlug}`);

    return actionSuccess(enabled ? absoluteUrl(`/roadmap/${publicSlug}`) : null);
  } catch (error) {
    return actionFailure(error);
  }
}

export async function setFeedbackPublicAction(
  feedbackId: string,
  isPublic: boolean,
  publicTitle?: string,
): Promise<ActionResult> {
  try {
    const context = await requireWorkspaceOrThrow();
    assertCan(context.role, 'feedback.update');

    const db = await getDb();

    await db
      .update(feedback)
      .set({
        isPublic,
        // An empty override clears rather than storing a blank title.
        ...(publicTitle !== undefined
          ? { publicTitle: publicTitle.trim() ? publicTitle.trim().slice(0, 200) : null }
          : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(feedback.workspaceId, context.workspaceId), eq(feedback.id, feedbackId)));

    revalidatePath(`/dashboard/feedback/${feedbackId}`);
    // The roadmap itself is dynamic, so nothing else needs invalidating.

    return actionSuccess();
  } catch (error) {
    return actionFailure(error);
  }
}
