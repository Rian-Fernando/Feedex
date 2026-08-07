import 'server-only';

import { and, eq } from 'drizzle-orm';

import { getDb } from '@/lib/db';
import { users, workspaceMembers, type NotificationPreferences } from '@/lib/db/schema';
import { emailConfigured, newFeedbackEmail, sendEmail } from '@/lib/email';
import { PRIORITY_WEIGHT } from '@/lib/taxonomy';
import type { Feedback } from '@/lib/db/schema';

/**
 * Who to tell, and telling them.
 *
 * Every function here is best-effort and swallows its own failures. A
 * notification is a courtesy attached to something that already succeeded —
 * a report was accepted and stored — and letting a mail provider outage turn
 * that into a 500 for the reporter would be the wrong trade by a wide margin.
 */

export async function updateNotificationPreferences(
  workspaceId: string,
  userId: string,
  preferences: NotificationPreferences,
): Promise<void> {
  const db = await getDb();

  await db
    .update(workspaceMembers)
    .set({ notifications: preferences })
    .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, userId)));
}

export async function getNotificationPreferences(
  workspaceId: string,
  userId: string,
): Promise<NotificationPreferences> {
  const db = await getDb();

  const rows = await db
    .select({ notifications: workspaceMembers.notifications })
    .from(workspaceMembers)
    .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, userId)))
    .limit(1);

  return rows[0]?.notifications ?? {};
}

/**
 * Emails everyone who asked to hear about a new report.
 *
 * Called with `void` from the ingestion path, after the response has been
 * composed. Nothing it does can affect whether the report was accepted.
 */
export async function notifyNewFeedback(input: {
  workspaceId: string;
  projectName: string;
  feedback: Feedback;
  categoryLabel: string;
}): Promise<void> {
  // Checked first so an unconfigured instance does not query the database on
  // every single submission for a feature it cannot perform.
  if (!emailConfigured()) return;

  try {
    const db = await getDb();

    const members = await db
      .select({
        email: users.email,
        notifications: workspaceMembers.notifications,
      })
      .from(workspaceMembers)
      .innerJoin(users, eq(workspaceMembers.userId, users.id))
      .where(eq(workspaceMembers.workspaceId, input.workspaceId));

    const threshold = PRIORITY_WEIGHT[input.feedback.priority] ?? 0;

    const recipients = members.filter((member) => {
      const preferences = member.notifications ?? {};
      if (!preferences.newFeedback) return false;

      // `minPriority` is a floor, not a match: someone who asked for "high and
      // above" must still hear about a critical one.
      const floor = preferences.minPriority ? (PRIORITY_WEIGHT[preferences.minPriority] ?? 0) : 0;
      return threshold >= floor;
    });

    const context = input.feedback.context as { path?: string };

    await Promise.all(
      recipients.map((member) =>
        sendEmail(
          newFeedbackEmail({
            to: member.email,
            projectName: input.projectName,
            reference: input.feedback.reference,
            title: input.feedback.title,
            description: input.feedback.description,
            category: input.categoryLabel,
            priority: input.feedback.priority,
            feedbackId: input.feedback.id,
            page: context?.path,
          }),
        ),
      ),
    );
  } catch (error) {
    // Logged, never rethrown: see the note at the top of this file.
    console.error('[feedex] notification dispatch failed', error);
  }
}
