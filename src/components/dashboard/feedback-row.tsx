import Link from 'next/link';
import { Globe, Monitor, Smartphone, Tablet } from 'lucide-react';

import { cn } from '@/lib/cn';
import { Badge } from '@/components/ui/badge';
import { categoryMeta, priorityMeta, statusMeta } from '@/lib/taxonomy';
import { displayUrl, timeAgo, truncate } from '@/lib/format';
import type { FeedbackWithProject } from '@/server/services/feedback';

const DEVICE_ICONS = {
  desktop: Monitor,
  tablet: Tablet,
  mobile: Smartphone,
} as const;

/**
 * One feedback item in a list.
 *
 * The whole row is a single link rather than a container with a nested link, so
 * the entire area is one keyboard stop and one hit target.
 */
export function FeedbackRow({
  item,
  showProject = true,
  className,
}: {
  item: FeedbackWithProject;
  showProject?: boolean;
  className?: string;
}) {
  const category = categoryMeta(item.category);
  const status = statusMeta(item.status);
  const priority = priorityMeta(item.priority);
  const DeviceIcon = item.context.device ? DEVICE_ICONS[item.context.device] : null;

  return (
    <Link
      href={`/dashboard/feedback/${item.id}`}
      className={cn(
        'group flex flex-col gap-2 rounded-lg px-2 py-3 transition-colors hover:bg-surface-inset/60',
        className,
      )}
    >
      <div className="flex items-start gap-2.5">
        <span
          aria-hidden
          className="mt-1.5 size-2 shrink-0 rounded-full"
          style={{ backgroundColor: item.projectColor }}
        />

        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-fg transition-colors group-hover:text-accent-500">
            {truncate(item.title, 110)}
          </p>
          <p className="mt-0.5 line-clamp-1 text-xs text-fg-muted">
            {truncate(item.description, 140)}
          </p>
        </div>

        <span className="shrink-0 text-xs whitespace-nowrap text-fg-subtle tabular-nums">
          {timeAgo(item.createdAt)}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 pl-4.5">
        <Badge tone={status.tone} size="sm" dot>
          {status.label}
        </Badge>
        <Badge tone={category.tone} size="sm">
          {category.label}
        </Badge>
        {item.priority !== 'medium' ? (
          <Badge tone={priority.tone} size="sm">
            {priority.label}
          </Badge>
        ) : null}

        {showProject ? (
          <span className="ml-0.5 truncate text-2xs text-fg-subtle">{item.projectName}</span>
        ) : null}

        {item.context.url ? (
          <span className="ml-auto hidden items-center gap-1 text-2xs text-fg-subtle sm:inline-flex">
            <Globe aria-hidden className="size-3" />
            {truncate(displayUrl(item.context.url), 34)}
          </span>
        ) : null}

        {DeviceIcon ? <DeviceIcon aria-hidden className="size-3 shrink-0 text-fg-subtle" /> : null}
      </div>
    </Link>
  );
}
