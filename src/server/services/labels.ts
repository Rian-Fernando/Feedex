import 'server-only';

import { and, asc, eq, inArray } from 'drizzle-orm';

import { getDb, type Database } from '@/lib/db';
import { feedback, workspaceLabels, type LabelKind, type WorkspaceLabel } from '@/lib/db/schema';
import { createId, ID_PREFIX } from '@/lib/ids';
import { AppError } from '@/lib/errors';
import { slugify } from '@/lib/ids';
import type { LabelInput } from '@/lib/validation';

/**
 * A workspace's statuses and categories.
 *
 * Every read is workspace-scoped, like the rest of the service layer. The
 * ordering is always by `position` so the board's columns, the filter menus,
 * and the widget's chips agree without each one imposing its own sort.
 */

/** The vocabulary every new workspace starts with. */
export const DEFAULT_LABELS: Array<Omit<LabelSeed, 'workspaceId'>> = [
  { kind: 'status', key: 'open', label: 'Open', tone: 'info', lifecycle: 'active' },
  { kind: 'status', key: 'in_progress', label: 'In progress', tone: 'accent', lifecycle: 'active' },
  { kind: 'status', key: 'testing', label: 'Testing', tone: 'warning', lifecycle: 'active' },
  { kind: 'status', key: 'resolved', label: 'Resolved', tone: 'success', lifecycle: 'done' },
  { kind: 'status', key: 'closed', label: 'Closed', tone: 'neutral', lifecycle: 'done' },
  { kind: 'category', key: 'bug', label: 'Bug', tone: 'danger', lifecycle: 'active' },
  {
    kind: 'category',
    key: 'feature',
    label: 'Feature request',
    tone: 'accent',
    lifecycle: 'active',
  },
  { kind: 'category', key: 'ui', label: 'UI issue', tone: 'info', lifecycle: 'active' },
  {
    kind: 'category',
    key: 'performance',
    label: 'Performance',
    tone: 'warning',
    lifecycle: 'active',
  },
  { kind: 'category', key: 'content', label: 'Content', tone: 'neutral', lifecycle: 'active' },
  { kind: 'category', key: 'question', label: 'Question', tone: 'info', lifecycle: 'active' },
  { kind: 'category', key: 'other', label: 'Other', tone: 'neutral', lifecycle: 'active' },
];

interface LabelSeed {
  workspaceId: string;
  kind: LabelKind;
  key: string;
  label: string;
  tone: string;
  lifecycle: 'active' | 'done';
}

/**
 * Creates the built-in vocabulary for a new workspace.
 *
 * Takes the transaction when called during workspace creation, so a workspace
 * can never exist without the labels its feedback will reference.
 */
export async function seedWorkspaceLabels(workspaceId: string, tx?: Database): Promise<void> {
  const db = tx ?? (await getDb());

  await db
    .insert(workspaceLabels)
    .values(
      DEFAULT_LABELS.map((entry, index) => ({
        id: createId(ID_PREFIX.label),
        workspaceId,
        kind: entry.kind,
        key: entry.key,
        label: entry.label,
        tone: entry.tone,
        lifecycle: entry.lifecycle,
        // Positions restart per kind, which is how they are read back.
        position: DEFAULT_LABELS.slice(0, index).filter((e) => e.kind === entry.kind).length,
        isSystem: true,
      })),
    )
    .onConflictDoNothing();
}

export async function listLabels(workspaceId: string, kind?: LabelKind): Promise<WorkspaceLabel[]> {
  const db = await getDb();

  return db
    .select()
    .from(workspaceLabels)
    .where(
      kind
        ? and(eq(workspaceLabels.workspaceId, workspaceId), eq(workspaceLabels.kind, kind))
        : eq(workspaceLabels.workspaceId, workspaceId),
    )
    .orderBy(asc(workspaceLabels.kind), asc(workspaceLabels.position));
}

export interface WorkspaceVocabulary {
  statuses: WorkspaceLabel[];
  categories: WorkspaceLabel[];
  /** Status keys that mean "still needs attention". */
  openStatusKeys: string[];
  /** Status keys that mean "finished". */
  doneStatusKeys: string[];
}

/**
 * Everything the dashboard needs to render one workspace's vocabulary.
 *
 * The two key lists replace the hard-coded OPEN_STATUSES / CLOSED_STATUSES
 * constants. Deriving them from `lifecycle` is what lets a workspace rename or
 * add a status without its open counts quietly becoming wrong.
 */
export async function getVocabulary(workspaceId: string): Promise<WorkspaceVocabulary> {
  const all = await listLabels(workspaceId);
  const statuses = all.filter((entry) => entry.kind === 'status');

  return {
    statuses,
    categories: all.filter((entry) => entry.kind === 'category'),
    openStatusKeys: statuses.filter((s) => s.lifecycle === 'active').map((s) => s.key),
    doneStatusKeys: statuses.filter((s) => s.lifecycle === 'done').map((s) => s.key),
  };
}

/**
 * Derives a unique key from a label name.
 *
 * Keys are permanent — they are written onto feedback rows — so this only runs
 * at creation. A collision gets a numeric suffix rather than an error, because
 * "Blocked" and "blocked!" slugging the same way is not something the person
 * naming a status should have to think about.
 */
async function uniqueKey(workspaceId: string, kind: LabelKind, name: string): Promise<string> {
  const base = slugify(name).replace(/-/g, '_').slice(0, 28) || 'label';
  const existing = await listLabels(workspaceId, kind);
  const taken = new Set(existing.map((entry) => entry.key));

  if (!taken.has(base)) return base;

  for (let suffix = 2; suffix < 100; suffix += 1) {
    const candidate = `${base}_${suffix}`;
    if (!taken.has(candidate)) return candidate;
  }

  throw AppError.conflict('Too many labels with a similar name.');
}

export async function createLabel(
  workspaceId: string,
  kind: LabelKind,
  input: LabelInput,
): Promise<WorkspaceLabel> {
  const db = await getDb();
  const existing = await listLabels(workspaceId, kind);

  if (existing.length >= 24) {
    throw AppError.validation('A workspace can have at most 24 of each label.');
  }

  const rows = await db
    .insert(workspaceLabels)
    .values({
      id: createId(ID_PREFIX.label),
      workspaceId,
      kind,
      key: await uniqueKey(workspaceId, kind, input.label),
      label: input.label,
      tone: input.tone,
      lifecycle: kind === 'status' ? input.lifecycle : 'active',
      position: existing.length,
      isSystem: false,
    })
    .returning();

  const created = rows[0];
  if (!created) throw new Error('Insert returned no row.');
  return created;
}

export async function updateLabel(
  workspaceId: string,
  labelId: string,
  input: LabelInput,
): Promise<WorkspaceLabel> {
  const db = await getDb();

  const rows = await db
    .update(workspaceLabels)
    .set({
      label: input.label,
      tone: input.tone,
      lifecycle: input.lifecycle,
      updatedAt: new Date(),
    })
    .where(and(eq(workspaceLabels.workspaceId, workspaceId), eq(workspaceLabels.id, labelId)))
    .returning();

  const updated = rows[0];
  if (!updated) throw AppError.notFound('Label not found.');
  return updated;
}

/**
 * Deletes a label, moving anything using it onto a replacement.
 *
 * A label cannot simply disappear: feedback rows point at its key, and leaving
 * them pointing at nothing would drop them out of every filter and off the
 * board entirely — data that still exists but can no longer be found. The
 * caller must name where those items go.
 */
export async function deleteLabel(
  workspaceId: string,
  labelId: string,
  reassignToKey: string,
): Promise<void> {
  const db = await getDb();

  const rows = await db
    .select()
    .from(workspaceLabels)
    .where(and(eq(workspaceLabels.workspaceId, workspaceId), eq(workspaceLabels.id, labelId)))
    .limit(1);

  const label = rows[0];
  if (!label) throw AppError.notFound('Label not found.');

  if (label.isSystem) {
    throw AppError.validation(
      'Built-in labels can be renamed and reordered, but not deleted — new feedback falls back to them.',
    );
  }

  const siblings = await listLabels(workspaceId, label.kind);
  const target = siblings.find((entry) => entry.key === reassignToKey && entry.id !== labelId);

  if (!target) {
    throw AppError.validation('Choose an existing label to move the affected feedback to.');
  }

  await db.transaction(async (tx) => {
    const column = label.kind === 'status' ? feedback.status : feedback.category;

    await tx
      .update(feedback)
      .set({ [label.kind]: target.key, updatedAt: new Date() })
      .where(and(eq(feedback.workspaceId, workspaceId), eq(column, label.key)));

    await tx
      .delete(workspaceLabels)
      .where(and(eq(workspaceLabels.workspaceId, workspaceId), eq(workspaceLabels.id, labelId)));
  });
}

/** Applies a new display order. Ids not in the list are left alone. */
export async function reorderLabels(
  workspaceId: string,
  kind: LabelKind,
  orderedIds: string[],
): Promise<void> {
  const db = await getDb();

  const owned = await db
    .select({ id: workspaceLabels.id })
    .from(workspaceLabels)
    .where(
      and(
        eq(workspaceLabels.workspaceId, workspaceId),
        eq(workspaceLabels.kind, kind),
        inArray(workspaceLabels.id, orderedIds.length ? orderedIds : ['']),
      ),
    );

  const ownedIds = new Set(owned.map((entry) => entry.id));

  await db.transaction(async (tx) => {
    for (const [index, id] of orderedIds.entries()) {
      // Filtered against ids this workspace actually owns, so a crafted payload
      // cannot renumber another tenant's labels.
      if (!ownedIds.has(id)) continue;

      await tx
        .update(workspaceLabels)
        .set({ position: index, updatedAt: new Date() })
        .where(and(eq(workspaceLabels.workspaceId, workspaceId), eq(workspaceLabels.id, id)));
    }
  });
}
