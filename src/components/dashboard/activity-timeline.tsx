import Link from 'next/link';

import { timeAgo } from '@/lib/format';
import type { ActivityEntry } from '@/server/services/activity';
import type { ActivityAction } from '@/lib/db/schema';

/**
 * Renders the audit trail as human sentences.
 *
 * The phrasing lives in one map keyed by action, so adding an activity type
 * means adding one entry rather than extending a chain of conditionals.
 */
const DOT_TONE: Partial<Record<ActivityAction, string>> = {
  'feedback.created': 'bg-accent-500',
  'feedback.status_changed': 'bg-info-500',
  'feedback.priority_changed': 'bg-warning-500',
  'feedback.deleted': 'bg-danger-500',
  'project.created': 'bg-success-500',
  'project.deleted': 'bg-danger-500',
  'api_key.created': 'bg-warning-500',
  'api_key.revoked': 'bg-danger-500',
};

function describe(entry: ActivityEntry): string {
  const meta = entry.metadata as Record<string, string | undefined>;
  const actor = entry.actorName ?? 'Someone';
  const title = meta.title ? `“${meta.title}”` : 'an item';

  switch (entry.action) {
    case 'workspace.created':
      return `${actor} created the workspace`;
    case 'project.created':
      return `${actor} created ${meta.name ?? 'a project'}`;
    case 'project.updated':
      return `${actor} updated ${meta.name ?? 'a project'}`;
    case 'project.archived':
      return `${actor} archived ${meta.name ?? 'a project'}`;
    case 'project.deleted':
      return `${actor} deleted ${meta.name ?? 'a project'}`;
    // Widget submissions have no actor, so this one reads in the passive voice.
    case 'feedback.created':
      return `New feedback: ${title}`;
    case 'feedback.status_changed':
      return `${actor} moved ${title} to ${meta.to?.replace('_', ' ') ?? 'a new status'}`;
    case 'feedback.priority_changed':
      return `${actor} set ${title} to ${meta.to ?? 'a new priority'} priority`;
    case 'feedback.category_changed':
      return `${actor} recategorised ${title}`;
    case 'feedback.assigned':
      return `${actor} assigned ${title}`;
    case 'feedback.deleted':
      return `${actor} deleted ${title}`;
    case 'note.created':
      return `${actor} added a note`;
    case 'api_key.created':
      return `${actor} rotated the ${meta.type ?? ''} key`.replace('  ', ' ');
    case 'api_key.revoked':
      return `${actor} revoked a key`;
    case 'member.invited':
      return `${actor} invited a member`;
    case 'member.removed':
      return `${actor} removed a member`;
    default:
      return `${actor} made a change`;
  }
}

function hrefFor(entry: ActivityEntry): string | null {
  if (entry.targetType === 'feedback' && entry.action !== 'feedback.deleted') {
    return `/dashboard/feedback/${entry.targetId}`;
  }
  if (entry.targetType === 'project' && entry.action !== 'project.deleted') {
    return `/dashboard/projects/${entry.targetId}`;
  }
  return null;
}

export function ActivityTimeline({ entries }: { entries: ActivityEntry[] }) {
  return (
    <ol className="flex flex-col">
      {entries.map((entry, index) => {
        const href = hrefFor(entry);
        const label = describe(entry);
        const isLast = index === entries.length - 1;

        const content = (
          <>
            <span className="relative flex shrink-0 flex-col items-center">
              <span
                aria-hidden
                className={`mt-1.5 size-2 rounded-full ${DOT_TONE[entry.action] ?? 'bg-plum-400'}`}
              />
              {/* Connector, omitted on the last entry so the line does not
                  trail off past the final event. */}
              {!isLast ? <span aria-hidden className="mt-1 w-px flex-1 bg-line-subtle" /> : null}
            </span>
            <span className="min-w-0 flex-1 pb-4">
              <span className="block text-sm leading-snug text-fg-muted">{label}</span>
              <span className="mt-0.5 block text-xs text-fg-subtle">
                {timeAgo(entry.createdAt)}
              </span>
            </span>
          </>
        );

        return (
          <li key={entry.id}>
            {href ? (
              <Link href={href} className="group flex gap-2.5 transition-colors hover:text-fg">
                {content}
              </Link>
            ) : (
              <div className="flex gap-2.5">{content}</div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
