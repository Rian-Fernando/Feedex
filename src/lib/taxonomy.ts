import type { FeedbackPriority, ProjectEnvironment, ProjectStatus } from '@/lib/db/schema';

/**
 * Display metadata for the enums that are still fixed.
 *
 * Statuses and categories used to live here too. They are workspace-defined
 * now and come from `workspace_labels`, so keeping a copy of the old lists
 * around would be a second source of truth that is wrong for any workspace
 * that has customised anything.
 *
 * What remains are the genuinely fixed dimensions — priority, project
 * environment, project status. The database owns the values; this module owns
 * how they are named, ordered,
 * and coloured. Keeping it in one place means the dashboard, the widget, the
 * public API documentation, and the seed data cannot drift apart.
 *
 * `tone` maps to a semantic colour token rather than a literal colour, so theme
 * changes do not require touching this file.
 */
export interface TaxonomyEntry<T extends string> {
  value: T;
  label: string;
  description: string;
  tone: 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'accent';
}

export const FEEDBACK_PRIORITIES: readonly TaxonomyEntry<FeedbackPriority>[] = [
  { value: 'low', label: 'Low', description: 'Nice to have.', tone: 'neutral' },
  { value: 'medium', label: 'Medium', description: 'Normal priority.', tone: 'info' },
  { value: 'high', label: 'High', description: 'Should be handled soon.', tone: 'warning' },
  {
    value: 'critical',
    label: 'Critical',
    description: 'Blocking users right now.',
    tone: 'danger',
  },
] as const;

export const PROJECT_ENVIRONMENTS: readonly TaxonomyEntry<ProjectEnvironment>[] = [
  {
    value: 'production',
    label: 'Production',
    description: 'Live traffic from real users.',
    tone: 'success',
  },
  { value: 'staging', label: 'Staging', description: 'Pre-release verification.', tone: 'warning' },
  {
    value: 'development',
    label: 'Development',
    description: 'Local or preview builds.',
    tone: 'neutral',
  },
] as const;

export const PROJECT_STATUSES: readonly TaxonomyEntry<ProjectStatus>[] = [
  { value: 'active', label: 'Active', description: 'Accepting feedback.', tone: 'success' },
  {
    value: 'paused',
    label: 'Paused',
    description: 'Widget installed but ingestion is rejected.',
    tone: 'warning',
  },
  {
    value: 'archived',
    label: 'Archived',
    description: 'Read-only; hidden from the default views.',
    tone: 'neutral',
  },
] as const;

function lookup<T extends string>(
  entries: readonly TaxonomyEntry<T>[],
): (value: T) => TaxonomyEntry<T> {
  const map = new Map(entries.map((entry) => [entry.value, entry]));
  return (value: T) => map.get(value) ?? entries[entries.length - 1]!;
}

export const priorityMeta = lookup(FEEDBACK_PRIORITIES);
export const environmentMeta = lookup(PROJECT_ENVIRONMENTS);
export const projectStatusMeta = lookup(PROJECT_STATUSES);

/** Ordering used when sorting by priority in list views. */
export const PRIORITY_WEIGHT: Record<FeedbackPriority, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

/**
 * Maps a label's tone onto a solid background class.
 *
 * Used where a coloured dot or bar segment stands in for a label — the
 * distribution bar on the overview, and the legend beside it. Tones are a
 * closed set, so an unknown value falling back to plum is a defensive default
 * rather than an expected path.
 */
export function toneBarClass(tone: string): string {
  switch (tone) {
    case 'danger':
      return 'bg-danger-500';
    case 'accent':
      return 'bg-accent-500';
    case 'info':
      return 'bg-info-500';
    case 'warning':
      return 'bg-warning-500';
    case 'success':
      return 'bg-success-500';
    default:
      return 'bg-plum-500';
  }
}

/**
 * Narrows a stored tone string to the Badge component's union.
 *
 * Tones come out of the database as text, because a workspace label's tone is
 * data. The set is closed and validated on write, so this is a type bridge
 * with a defensive fallback rather than real branching.
 */
export function asTone(tone: string): import('@/components/ui/badge').BadgeTone {
  switch (tone) {
    case 'info':
    case 'accent':
    case 'success':
    case 'warning':
    case 'danger':
      return tone;
    default:
      return 'neutral';
  }
}
