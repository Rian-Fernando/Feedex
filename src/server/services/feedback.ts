import 'server-only';

import { and, asc, count, desc, eq, gte, ilike, inArray, lt, or, sql } from 'drizzle-orm';

import { getDb } from '@/lib/db';
import {
  feedback,
  feedbackAttachments,
  feedbackNotes,
  projects,
  users,
  type Feedback,
  type FeedbackContext,
  type FeedbackCategory,
  type FeedbackPriority,
  type FeedbackStatus,
} from '@/lib/db/schema';
import { createId, ID_PREFIX } from '@/lib/ids';
import { AppError } from '@/lib/errors';
import { base64ByteLength } from '@/lib/attachments';
import { PRIORITY_WEIGHT } from '@/lib/taxonomy';
import { getVocabulary, type WorkspaceVocabulary } from '@/server/services/labels';
import type { FeedbackFilterInput, UpdateFeedbackInput } from '@/lib/validation';

/**
 * Feedback operations.
 *
 * Reads are workspace-scoped; the ingestion path is the one exception, since it
 * is authenticated by a project's public key rather than by a session, and
 * derives the workspace from the key's project.
 */

export interface FeedbackWithProject extends Feedback {
  projectName: string;
  projectColor: string;
  projectSlug: string;
  assigneeName: string | null;
  /*
    Display names and tones for this item's status and category, resolved from
    the workspace's own vocabulary before the data leaves the server.

    Attached here rather than looked up in each component because the labels are
    per workspace now: a component doing `statusMeta(item.status)` against a
    module-level constant would silently render the wrong name — or nothing at
    all — the moment a team renamed a status or invented one.
  */
  statusLabel: string;
  statusTone: string;
  categoryLabel: string;
  categoryTone: string;
}

/** Attaches display labels to rows fetched from the database. */
function decorate<T extends Feedback>(
  rows: T[],
  vocabulary: WorkspaceVocabulary,
): Array<
  T & Pick<FeedbackWithProject, 'statusLabel' | 'statusTone' | 'categoryLabel' | 'categoryTone'>
> {
  const statuses = new Map(vocabulary.statuses.map((entry) => [entry.key, entry]));
  const categories = new Map(vocabulary.categories.map((entry) => [entry.key, entry]));

  return rows.map((row) => {
    const status = statuses.get(row.status);
    const category = categories.get(row.category);

    return {
      ...row,
      // A key with no matching label means the label was deleted out from under
      // the row. Showing the raw key beats showing nothing.
      statusLabel: status?.label ?? row.status,
      statusTone: status?.tone ?? 'neutral',
      categoryLabel: category?.label ?? row.category,
      categoryTone: category?.tone ?? 'neutral',
    };
  });
}

export interface PaginatedFeedback {
  items: FeedbackWithProject[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

export async function listFeedback(
  workspaceId: string,
  filter: FeedbackFilterInput,
): Promise<PaginatedFeedback> {
  const db = await getDb();
  const conditions = [eq(feedback.workspaceId, workspaceId)];

  if (filter.projectId) conditions.push(eq(feedback.projectId, filter.projectId));
  if (filter.status) conditions.push(eq(feedback.status, filter.status));
  if (filter.priority) conditions.push(eq(feedback.priority, filter.priority));
  if (filter.category) conditions.push(eq(feedback.category, filter.category));

  if (filter.q) {
    // Substring search across the fields a user would recall. Deliberately
    // simple: Postgres full-text search is the upgrade path once volume makes
    // ILIKE too slow, and it slots in behind this same function.
    const pattern = `%${escapeLike(filter.q)}%`;
    const search = or(
      ilike(feedback.title, pattern),
      ilike(feedback.description, pattern),
      ilike(feedback.reporterEmail, pattern),
    );
    if (search) conditions.push(search);
  }

  const where = and(...conditions);

  const orderBy = (() => {
    switch (filter.sort) {
      case 'oldest':
        return [asc(feedback.createdAt)];
      case 'priority':
        // Enum ordering in Postgres follows declaration order, which is
        // low→critical, so the mapping is spelled out to stay explicit.
        return [
          sql`case ${feedback.priority}
                when 'critical' then ${PRIORITY_WEIGHT.critical}
                when 'high' then ${PRIORITY_WEIGHT.high}
                when 'medium' then ${PRIORITY_WEIGHT.medium}
                else ${PRIORITY_WEIGHT.low}
              end desc`,
          desc(feedback.createdAt),
        ];
      default:
        return [desc(feedback.createdAt)];
    }
  })();

  const offset = (filter.page - 1) * filter.perPage;

  const [items, totals] = await Promise.all([
    db
      .select({
        feedback,
        projectName: projects.name,
        projectColor: projects.color,
        projectSlug: projects.slug,
        assigneeName: users.name,
      })
      .from(feedback)
      .innerJoin(projects, eq(feedback.projectId, projects.id))
      .leftJoin(users, eq(feedback.assignedToId, users.id))
      .where(where)
      .orderBy(...orderBy)
      .limit(filter.perPage)
      .offset(offset),
    db.select({ value: count() }).from(feedback).where(where),
  ]);

  const total = totals[0]?.value ?? 0;
  const vocabulary = await getVocabulary(workspaceId);

  return {
    items: decorate(
      items.map((row) => ({
        ...row.feedback,
        projectName: row.projectName,
        projectColor: row.projectColor,
        projectSlug: row.projectSlug,
        assigneeName: row.assigneeName,
      })),
      vocabulary,
    ),
    total,
    page: filter.page,
    perPage: filter.perPage,
    totalPages: Math.max(1, Math.ceil(total / filter.perPage)),
  };
}

/** `%` and `_` are wildcards in LIKE and must not come from user input. */
function escapeLike(input: string): string {
  return input.replace(/[\\%_]/g, (char) => `\\${char}`);
}

export async function getFeedback(
  workspaceId: string,
  feedbackId: string,
): Promise<FeedbackWithProject | null> {
  const db = await getDb();

  const rows = await db
    .select({
      feedback,
      projectName: projects.name,
      projectColor: projects.color,
      projectSlug: projects.slug,
      assigneeName: users.name,
    })
    .from(feedback)
    .innerJoin(projects, eq(feedback.projectId, projects.id))
    .leftJoin(users, eq(feedback.assignedToId, users.id))
    .where(and(eq(feedback.workspaceId, workspaceId), eq(feedback.id, feedbackId)))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  const vocabulary = await getVocabulary(workspaceId);

  return decorate(
    [
      {
        ...row.feedback,
        projectName: row.projectName,
        projectColor: row.projectColor,
        projectSlug: row.projectSlug,
        assigneeName: row.assigneeName,
      },
    ],
    vocabulary,
  )[0]!;
}

/* ------------------------------- Ingestion -------------------------------- */

export interface IngestAttachment {
  name: string;
  /** Already validated against the allowlist by the caller. */
  type: string;
  /** Base64, no data-URL prefix. */
  data: string;
}

export interface IngestInput {
  workspaceId: string;
  projectId: string;
  category: FeedbackCategory;
  title?: string;
  description: string;
  reporterEmail?: string | null;
  reporterName?: string | null;
  context: FeedbackContext;
  priority?: FeedbackPriority;
  attachments?: IngestAttachment[];
}

/**
 * Creates a feedback item from an untrusted source (the widget or the API).
 *
 * The per-project reference number is allocated from the current maximum inside
 * the insert, with a bounded retry: two simultaneous submissions can compute the
 * same next value, and the unique index on (project_id, reference) turns that
 * race into a retryable conflict rather than a duplicate.
 */
export async function ingestFeedback(input: IngestInput): Promise<Feedback> {
  const db = await getDb();
  const title = deriveTitle(input.title, input.description);

  const MAX_ATTEMPTS = 5;
  let lastError: unknown;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    try {
      const rows = await db
        .insert(feedback)
        .values({
          id: createId(ID_PREFIX.feedback),
          workspaceId: input.workspaceId,
          projectId: input.projectId,
          reference: sql`(select coalesce(max(${feedback.reference}), 0) + 1 from ${feedback} where ${feedback.projectId} = ${input.projectId})`,
          title,
          description: input.description,
          category: input.category,
          status: 'open',
          priority: input.priority ?? 'medium',
          reporterEmail: input.reporterEmail || null,
          reporterName: input.reporterName || null,
          context: input.context,
          tags: [],
        })
        .returning();

      const created = rows[0];
      if (!created) throw new Error('Insert returned no row.');

      if (input.attachments?.length) {
        await db.insert(feedbackAttachments).values(
          input.attachments.map((file) => ({
            id: createId(ID_PREFIX.attachment),
            feedbackId: created.id,
            // Carried from the report rather than re-derived, so an attachment
            // can never end up on a different tenant than its parent.
            workspaceId: created.workspaceId,
            name: file.name,
            mimeType: file.type,
            size: base64ByteLength(file.data),
            data: file.data,
          })),
        );
      }

      return created;
    } catch (error) {
      lastError = error;
      if (!isUniqueViolation(error)) throw error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('Could not allocate a feedback reference.');
}

function isUniqueViolation(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const code = (error as { code?: unknown }).code;
  const message = (error as { message?: unknown }).message;
  return (
    code === '23505' || (typeof message === 'string' && message.includes('duplicate key value'))
  );
}

/**
 * Uses the caller-supplied title when present, otherwise derives one from the
 * first sentence of the description so every item is scannable in a list.
 */
function deriveTitle(title: string | undefined, description: string): string {
  const explicit = title?.trim();
  if (explicit) return explicit.slice(0, 200);

  const firstLine = description.split('\n')[0]?.trim() ?? description.trim();
  const sentenceEnd = firstLine.search(/[.!?](\s|$)/);
  const candidate = sentenceEnd > 12 ? firstLine.slice(0, sentenceEnd + 1) : firstLine;

  return (
    (candidate.length > 90 ? `${candidate.slice(0, 87)}...` : candidate).slice(0, 200) ||
    'Untitled feedback'
  );
}

/* -------------------------------- Mutations ------------------------------- */

export async function updateFeedback(
  workspaceId: string,
  feedbackId: string,
  input: UpdateFeedbackInput,
): Promise<Feedback> {
  const db = await getDb();

  const existing = await db
    .select()
    .from(feedback)
    .where(and(eq(feedback.workspaceId, workspaceId), eq(feedback.id, feedbackId)))
    .limit(1);

  const current = existing[0];
  if (!current) throw AppError.notFound('Feedback not found.');

  const nextStatus = input.status ?? current.status;

  /*
    "Finished" is a property of the workspace's own status list, not of the
    name. A team that renames Resolved, or adds "Won't fix" as a done status,
    must still get `resolved_at` stamped correctly — otherwise its metrics
    drift the moment it customises anything.
  */
  const vocabulary = await getVocabulary(workspaceId);

  if (input.status && !vocabulary.statuses.some((entry) => entry.key === input.status)) {
    throw AppError.validation('That status does not exist in this workspace.');
  }

  if (input.category && !vocabulary.categories.some((entry) => entry.key === input.category)) {
    throw AppError.validation('That category does not exist in this workspace.');
  }

  const doneKeys = new Set(vocabulary.doneStatusKeys);
  const isNowClosed = doneKeys.has(nextStatus);
  const wasClosed = doneKeys.has(current.status);

  const rows = await db
    .update(feedback)
    .set({
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.priority !== undefined ? { priority: input.priority } : {}),
      ...(input.category !== undefined ? { category: input.category } : {}),
      ...(input.assignedToId !== undefined ? { assignedToId: input.assignedToId } : {}),
      ...(input.tags !== undefined ? { tags: input.tags } : {}),
      // Stamp the moment work finished, and clear it if the item is reopened.
      ...(isNowClosed && !wasClosed ? { resolvedAt: new Date() } : {}),
      ...(!isNowClosed && wasClosed ? { resolvedAt: null } : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(feedback.workspaceId, workspaceId), eq(feedback.id, feedbackId)))
    .returning();

  const updated = rows[0];
  if (!updated) throw AppError.notFound('Feedback not found.');
  return updated;
}

export async function deleteFeedback(workspaceId: string, feedbackId: string): Promise<void> {
  const db = await getDb();
  await db
    .delete(feedback)
    .where(and(eq(feedback.workspaceId, workspaceId), eq(feedback.id, feedbackId)));
}

/* ------------------------------- Attachments ------------------------------ */

/** Attachment metadata, without the payload. */
export interface AttachmentView {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  createdAt: Date;
}

export async function listAttachments(
  workspaceId: string,
  feedbackId: string,
): Promise<AttachmentView[]> {
  const db = await getDb();

  return db
    .select({
      id: feedbackAttachments.id,
      name: feedbackAttachments.name,
      mimeType: feedbackAttachments.mimeType,
      size: feedbackAttachments.size,
      createdAt: feedbackAttachments.createdAt,
    })
    .from(feedbackAttachments)
    .where(
      and(
        eq(feedbackAttachments.workspaceId, workspaceId),
        eq(feedbackAttachments.feedbackId, feedbackId),
      ),
    )
    .orderBy(asc(feedbackAttachments.createdAt));
}

export interface AttachmentPayload extends AttachmentView {
  data: string;
}

/**
 * One attachment, payload included.
 *
 * Workspace-scoped in the query itself rather than fetched and then checked, so
 * a member of another workspace holding a valid attachment id gets the same
 * empty result as someone holding a made-up one — the row is invisible, not
 * merely forbidden.
 */
export async function getAttachment(
  workspaceId: string,
  attachmentId: string,
): Promise<AttachmentPayload | null> {
  const db = await getDb();

  const rows = await db
    .select({
      id: feedbackAttachments.id,
      name: feedbackAttachments.name,
      mimeType: feedbackAttachments.mimeType,
      size: feedbackAttachments.size,
      createdAt: feedbackAttachments.createdAt,
      data: feedbackAttachments.data,
    })
    .from(feedbackAttachments)
    .where(
      and(
        eq(feedbackAttachments.workspaceId, workspaceId),
        eq(feedbackAttachments.id, attachmentId),
      ),
    )
    .limit(1);

  return rows[0] ?? null;
}

/* ---------------------------------- Notes --------------------------------- */

export interface NoteView {
  id: string;
  body: string;
  createdAt: Date;
  authorName: string | null;
}

export async function listNotes(workspaceId: string, feedbackId: string): Promise<NoteView[]> {
  const db = await getDb();

  return db
    .select({
      id: feedbackNotes.id,
      body: feedbackNotes.body,
      createdAt: feedbackNotes.createdAt,
      authorName: users.name,
    })
    .from(feedbackNotes)
    .innerJoin(feedback, eq(feedbackNotes.feedbackId, feedback.id))
    .leftJoin(users, eq(feedbackNotes.authorId, users.id))
    .where(and(eq(feedback.workspaceId, workspaceId), eq(feedbackNotes.feedbackId, feedbackId)))
    .orderBy(asc(feedbackNotes.createdAt));
}

export async function createNote(
  workspaceId: string,
  feedbackId: string,
  authorId: string,
  body: string,
): Promise<void> {
  const db = await getDb();

  // Confirms the item belongs to the caller's workspace before writing.
  const owner = await db
    .select({ id: feedback.id })
    .from(feedback)
    .where(and(eq(feedback.workspaceId, workspaceId), eq(feedback.id, feedbackId)))
    .limit(1);

  if (!owner[0]) throw AppError.notFound('Feedback not found.');

  await db.insert(feedbackNotes).values({
    id: createId(ID_PREFIX.note),
    feedbackId,
    authorId,
    body,
  });
}

/* -------------------------------- Analytics ------------------------------- */

export interface WorkspaceStats {
  projects: number;
  totalFeedback: number;
  openFeedback: number;
  resolvedFeedback: number;
  last7Days: number;
  previous7Days: number;
  byStatus: Record<FeedbackStatus, number>;
  byCategory: Record<FeedbackCategory, number>;
  byPriority: Record<FeedbackPriority, number>;
  /** 14 daily buckets, oldest first, for the overview sparkline. */
  trend: Array<{ date: string; count: number }>;
}

export async function getWorkspaceStats(workspaceId: string): Promise<WorkspaceStats> {
  const db = await getDb();
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  const scope = eq(feedback.workspaceId, workspaceId);

  const [
    projectCount,
    statusRows,
    categoryRows,
    priorityRows,
    currentWindow,
    previousWindow,
    trendRows,
  ] = await Promise.all([
    db.select({ value: count() }).from(projects).where(eq(projects.workspaceId, workspaceId)),
    db
      .select({ status: feedback.status, value: count() })
      .from(feedback)
      .where(scope)
      .groupBy(feedback.status),
    db
      .select({ category: feedback.category, value: count() })
      .from(feedback)
      .where(scope)
      .groupBy(feedback.category),
    db
      .select({ priority: feedback.priority, value: count() })
      .from(feedback)
      .where(scope)
      .groupBy(feedback.priority),
    // Two plain counts rather than one grouped CASE. Drizzle renders a bare
    // column reference unqualified in SELECT but qualified in GROUP BY, which
    // Postgres refuses to match; counting each window separately sidesteps
    // that and reads more plainly besides.
    db
      .select({ value: count() })
      .from(feedback)
      .where(and(scope, gte(feedback.createdAt, sevenDaysAgo))),
    db
      .select({ value: count() })
      .from(feedback)
      .where(
        and(scope, gte(feedback.createdAt, fourteenDaysAgo), lt(feedback.createdAt, sevenDaysAgo)),
      ),
    db
      .select({
        day: sql<string>`to_char(date_trunc('day', ${feedback.createdAt}), 'YYYY-MM-DD')`,
        value: count(),
      })
      .from(feedback)
      .where(and(scope, gte(feedback.createdAt, fourteenDaysAgo)))
      .groupBy(sql`date_trunc('day', ${feedback.createdAt})`)
      .orderBy(sql`date_trunc('day', ${feedback.createdAt})`),
  ]);

  /*
    Seeded from this workspace's labels so a status with no feedback still shows
    up as zero rather than being absent, and a custom one is counted at all.
  */
  const vocabulary = await getVocabulary(workspaceId);

  const byStatus = emptyRecord<FeedbackStatus>(vocabulary.statuses.map((entry) => entry.key));
  for (const row of statusRows) byStatus[row.status] = row.value;

  const byCategory = emptyRecord<FeedbackCategory>(vocabulary.categories.map((entry) => entry.key));
  for (const row of categoryRows) byCategory[row.category] = row.value;

  const byPriority = emptyRecord<FeedbackPriority>(['low', 'medium', 'high', 'critical']);
  for (const row of priorityRows) byPriority[row.priority] = row.value;

  const totalFeedback = Object.values(byStatus).reduce((sum, value) => sum + value, 0);
  const openFeedback = vocabulary.openStatusKeys.reduce(
    (sum, status) => sum + (byStatus[status] ?? 0),
    0,
  );
  const resolvedFeedback = vocabulary.doneStatusKeys.reduce(
    (sum, status) => sum + (byStatus[status] ?? 0),
    0,
  );

  const trendMap = new Map(trendRows.map((row) => [row.day, row.value]));
  const trend: Array<{ date: string; count: number }> = [];
  for (let i = 13; i >= 0; i -= 1) {
    const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    trend.push({ date, count: trendMap.get(date) ?? 0 });
  }

  return {
    projects: projectCount[0]?.value ?? 0,
    totalFeedback,
    openFeedback,
    resolvedFeedback,
    last7Days: currentWindow[0]?.value ?? 0,
    previous7Days: previousWindow[0]?.value ?? 0,
    byStatus,
    byCategory,
    byPriority,
    trend,
  };
}

function emptyRecord<T extends string>(keys: readonly T[]): Record<T, number> {
  return Object.fromEntries(keys.map((key) => [key, 0])) as Record<T, number>;
}

/** Most recent items for the overview page. */
export async function recentFeedback(
  workspaceId: string,
  limit = 5,
): Promise<FeedbackWithProject[]> {
  const result = await listFeedback(workspaceId, {
    sort: 'newest',
    page: 1,
    perPage: limit,
  });
  return result.items;
}

/** Cross-resource search used by the dashboard command palette. */
export async function searchFeedback(
  workspaceId: string,
  query: string,
  limit = 8,
): Promise<FeedbackWithProject[]> {
  if (!query.trim()) return [];
  const result = await listFeedback(workspaceId, {
    q: query,
    sort: 'newest',
    page: 1,
    perPage: limit,
  });
  return result.items;
}

/** Statuses considered open, exported for callers that build their own queries. */
export async function openStatusFilter(workspaceId: string) {
  const { openStatusKeys } = await getVocabulary(workspaceId);
  return inArray(feedback.status, openStatusKeys.length ? openStatusKeys : ['']);
}
