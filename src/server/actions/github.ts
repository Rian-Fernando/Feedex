'use server';

import { revalidatePath } from 'next/cache';
import { eq, and } from 'drizzle-orm';

import { assertCan, requireWorkspaceOrThrow } from '@/lib/auth';
import { AppError, actionFailure, actionSuccess, type ActionResult } from '@/lib/errors';
import { getDb } from '@/lib/db';
import { feedback, projects } from '@/lib/db/schema';
import { getProviderToken } from '@/server/services/accounts';
import { getFeedback, listAttachments } from '@/server/services/feedback';
import { requireProject } from '@/server/services/projects';
import { createIssue, issueBody, parseRepo, verifyRepoAccess } from '@/lib/github';
import { absoluteUrl } from '@/config/site';

/**
 * Filing feedback as a GitHub issue.
 *
 * Uses the acting user's own GitHub token rather than a shared installation.
 * That keeps GitHub's permissions authoritative — you can only file where you
 * could already file — and attributes the issue to a person instead of a bot.
 */

/** The connected token, or a message telling the caller how to get one. */
async function requireGithubToken(userId: string): Promise<string> {
  const connection = await getProviderToken(userId, 'github');

  if (!connection) {
    throw AppError.validation('Connect your GitHub account in Settings before filing issues.');
  }

  // The sign-in scope cannot open issues. Checking here means the person is
  // told to reconnect, rather than GitHub returning an opaque 403 later.
  if (!connection.scope?.split(/[,\s]+/).includes('repo')) {
    throw AppError.validation(
      'Your GitHub connection cannot create issues. Reconnect it in Settings to grant repository access.',
    );
  }

  return connection.accessToken;
}

export async function connectedToGithub(): Promise<boolean> {
  const context = await requireWorkspaceOrThrow();
  const connection = await getProviderToken(context.user.id, 'github');
  return Boolean(connection?.scope?.split(/[,\s]+/).includes('repo'));
}

export async function setProjectRepoAction(projectId: string, repo: string): Promise<ActionResult> {
  try {
    const context = await requireWorkspaceOrThrow();
    assertCan(context.role, 'project.update');
    await requireProject(context.workspaceId, projectId);

    const db = await getDb();
    const trimmed = repo.trim();

    if (!trimmed) {
      await db
        .update(projects)
        .set({ githubRepo: null, updatedAt: new Date() })
        .where(and(eq(projects.workspaceId, context.workspaceId), eq(projects.id, projectId)));

      revalidatePath(`/dashboard/projects/${projectId}`);
      return actionSuccess();
    }

    // Shape first, then reachability — so an obvious typo does not cost a
    // round trip to GitHub.
    parseRepo(trimmed);
    await verifyRepoAccess(await requireGithubToken(context.user.id), trimmed);

    await db
      .update(projects)
      .set({ githubRepo: trimmed, updatedAt: new Date() })
      .where(and(eq(projects.workspaceId, context.workspaceId), eq(projects.id, projectId)));

    revalidatePath(`/dashboard/projects/${projectId}`);
    return actionSuccess();
  } catch (error) {
    return actionFailure(error);
  }
}

export async function createGithubIssueAction(feedbackId: string): Promise<ActionResult<string>> {
  try {
    const context = await requireWorkspaceOrThrow();
    assertCan(context.role, 'feedback.update');

    const item = await getFeedback(context.workspaceId, feedbackId);
    if (!item) throw AppError.notFound('Feedback not found.');

    // Already filed. Returning the existing URL rather than opening a second
    // issue is the whole reason the link is stored on the row.
    if (item.githubIssueUrl) return actionSuccess(item.githubIssueUrl);

    const project = await requireProject(context.workspaceId, item.projectId);

    if (!project.githubRepo) {
      throw AppError.validation(
        'This project has no GitHub repository set. Add one under the project’s settings.',
      );
    }

    const token = await requireGithubToken(context.user.id);
    const attachments = await listAttachments(context.workspaceId, feedbackId);

    const issue = await createIssue({
      token,
      repo: project.githubRepo,
      title: item.title,
      body: issueBody({
        description: item.description,
        reference: item.reference,
        projectName: item.projectName,
        reporterEmail: item.reporterEmail,
        category: item.categoryLabel,
        priority: item.priority,
        context: item.context as Record<string, unknown>,
        attachments,
        feedbackUrl: absoluteUrl(`/dashboard/feedback/${item.id}`),
      }),
      labels: ['feedex', item.categoryLabel.toLowerCase()],
    });

    const db = await getDb();
    await db
      .update(feedback)
      .set({
        githubIssueUrl: issue.url,
        githubIssueNumber: issue.number,
        updatedAt: new Date(),
      })
      .where(and(eq(feedback.workspaceId, context.workspaceId), eq(feedback.id, feedbackId)));

    revalidatePath(`/dashboard/feedback/${feedbackId}`);
    return actionSuccess(issue.url);
  } catch (error) {
    return actionFailure(error);
  }
}
