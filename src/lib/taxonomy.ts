import type {
  FeedbackCategory,
  FeedbackPriority,
  FeedbackStatus,
  ProjectEnvironment,
  ProjectStatus,
} from '@/lib/db/schema';

/**
 * Display metadata for the domain enums.
 *
 * The database owns the values; this module owns how they are named, ordered,
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

export const FEEDBACK_CATEGORIES: readonly TaxonomyEntry<FeedbackCategory>[] = [
  {
    value: 'bug',
    label: 'Bug',
    description: 'Something is broken or behaving incorrectly.',
    tone: 'danger',
  },
  {
    value: 'feature',
    label: 'Feature request',
    description: 'A capability that does not exist yet.',
    tone: 'accent',
  },
  {
    value: 'ui',
    label: 'UI issue',
    description: 'Layout, spacing, contrast, or visual polish.',
    tone: 'info',
  },
  {
    value: 'performance',
    label: 'Performance',
    description: 'Slow loads, jank, or excessive resource use.',
    tone: 'warning',
  },
  {
    value: 'content',
    label: 'Content',
    description: 'Copy errors, stale information, or broken links.',
    tone: 'neutral',
  },
  {
    value: 'question',
    label: 'Question',
    description: 'The reporter needs help or clarification.',
    tone: 'info',
  },
  {
    value: 'other',
    label: 'Other',
    description: 'Anything that does not fit the categories above.',
    tone: 'neutral',
  },
] as const;

export const FEEDBACK_STATUSES: readonly TaxonomyEntry<FeedbackStatus>[] = [
  { value: 'open', label: 'Open', description: 'Triaged but not started.', tone: 'info' },
  {
    value: 'in_progress',
    label: 'In progress',
    description: 'Actively being worked on.',
    tone: 'accent',
  },
  {
    value: 'testing',
    label: 'Testing',
    description: 'Fixed and awaiting verification.',
    tone: 'warning',
  },
  {
    value: 'resolved',
    label: 'Resolved',
    description: 'Shipped and confirmed working.',
    tone: 'success',
  },
  {
    value: 'closed',
    label: 'Closed',
    description: 'No further action will be taken.',
    tone: 'neutral',
  },
] as const;

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

/** Statuses that count as "still needs attention" in dashboard metrics. */
export const OPEN_STATUSES: readonly FeedbackStatus[] = ['open', 'in_progress', 'testing'];

/** Statuses that count as "done". */
export const CLOSED_STATUSES: readonly FeedbackStatus[] = ['resolved', 'closed'];

function lookup<T extends string>(
  entries: readonly TaxonomyEntry<T>[],
): (value: T) => TaxonomyEntry<T> {
  const map = new Map(entries.map((entry) => [entry.value, entry]));
  return (value: T) => map.get(value) ?? entries[entries.length - 1]!;
}

export const categoryMeta = lookup(FEEDBACK_CATEGORIES);
export const statusMeta = lookup(FEEDBACK_STATUSES);
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
