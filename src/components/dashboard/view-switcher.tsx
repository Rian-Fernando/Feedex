'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Columns3, List } from 'lucide-react';

import { cn } from '@/lib/cn';

/**
 * List / board toggle.
 *
 * The choice lives in the URL rather than in local state or storage, so a view
 * survives a reload, can be linked to a colleague, and keeps whatever filters
 * are already applied — the board of one project's open bugs is a URL.
 */

const VIEWS = [
  { value: 'list', label: 'List', icon: List },
  { value: 'board', label: 'Board', icon: Columns3 },
] as const;

export type FeedbackView = (typeof VIEWS)[number]['value'];

export function ViewSwitcher({ current }: { current: FeedbackView }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const select = (view: FeedbackView) => {
    const next = new URLSearchParams(searchParams.toString());

    // `list` is the default, so it stays out of the URL rather than pinning a
    // redundant parameter onto every link that gets shared.
    if (view === 'list') next.delete('view');
    else next.set('view', view);

    // Paging is meaningless across a view change: the board shows the whole
    // queue at once, and page 3 of a list is not page 3 of anything here.
    next.delete('page');

    const query = next.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  };

  return (
    <div
      role="group"
      aria-label="View"
      className="inline-flex shrink-0 rounded-lg border border-line bg-surface-inset p-0.5"
    >
      {VIEWS.map((view) => {
        const active = view.value === current;
        const Icon = view.icon;

        return (
          <button
            key={view.value}
            type="button"
            onClick={() => select(view.value)}
            aria-pressed={active}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
              active ? 'bg-surface-raised text-fg shadow-sm' : 'text-fg-subtle hover:text-fg-muted',
            )}
          >
            <Icon aria-hidden className="size-3.5" />
            {view.label}
          </button>
        );
      })}
    </div>
  );
}
