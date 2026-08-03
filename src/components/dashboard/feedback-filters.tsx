'use client';

import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Search, X } from 'lucide-react';

import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/field';
import { FEEDBACK_PRIORITIES } from '@/lib/taxonomy';

/**
 * Filter bar for the feedback list.
 *
 * Filters live in the URL rather than component state, so a filtered view is
 * shareable, survives a reload, and works with browser history. Each change
 * resets pagination, because staying on page 4 of a narrower result set is
 * almost never what the user meant.
 */
/** A status or category as the workspace has defined it. */
export interface FilterLabel {
  key: string;
  label: string;
}

export function FeedbackFilters({
  projects,
  statuses,
  categories,
}: {
  projects: Array<{ id: string; name: string }>;
  statuses: FilterLabel[];
  categories: FilterLabel[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [query, setQuery] = React.useState(params.get('q') ?? '');

  const update = React.useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(params.toString());
      if (value) next.set(key, value);
      else next.delete(key);
      next.delete('page');
      router.push(`${pathname}?${next.toString()}`);
    },
    [params, pathname, router],
  );

  // Debounced so typing does not push a history entry per keystroke.
  React.useEffect(() => {
    const current = params.get('q') ?? '';
    if (query === current) return;

    const timer = setTimeout(() => update('q', query), 350);
    return () => clearTimeout(timer);
  }, [query, params, update]);

  const hasFilters = ['q', 'status', 'priority', 'category', 'projectId'].some((key) =>
    params.get(key),
  );

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <div className="relative min-w-48 flex-1">
        <Search
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-fg-subtle"
        />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search feedback…"
          aria-label="Search feedback"
          className={cn(
            'h-9 w-full rounded-lg border border-line bg-surface-raised pr-3 pl-9 text-sm text-fg placeholder:text-fg-subtle',
            'hover:border-line-strong focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20 focus:outline-none',
          )}
        />
      </div>

      {projects.length > 1 ? (
        <NativeSelect
          aria-label="Filter by project"
          value={params.get('projectId') ?? ''}
          onChange={(event) => update('projectId', event.target.value)}
          className="w-auto min-w-36"
        >
          <option value="">All projects</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </NativeSelect>
      ) : null}

      <NativeSelect
        aria-label="Filter by status"
        value={params.get('status') ?? ''}
        onChange={(event) => update('status', event.target.value)}
        className="w-auto min-w-32"
      >
        <option value="">All statuses</option>
        {statuses.map((status) => (
          <option key={status.key} value={status.key}>
            {status.label}
          </option>
        ))}
      </NativeSelect>

      <NativeSelect
        aria-label="Filter by category"
        value={params.get('category') ?? ''}
        onChange={(event) => update('category', event.target.value)}
        className="w-auto min-w-36"
      >
        <option value="">All categories</option>
        {categories.map((category) => (
          <option key={category.key} value={category.key}>
            {category.label}
          </option>
        ))}
      </NativeSelect>

      <NativeSelect
        aria-label="Filter by priority"
        value={params.get('priority') ?? ''}
        onChange={(event) => update('priority', event.target.value)}
        className="w-auto min-w-32"
      >
        <option value="">All priorities</option>
        {FEEDBACK_PRIORITIES.map((priority) => (
          <option key={priority.value} value={priority.value}>
            {priority.label}
          </option>
        ))}
      </NativeSelect>

      <NativeSelect
        aria-label="Sort order"
        value={params.get('sort') ?? 'newest'}
        onChange={(event) => update('sort', event.target.value)}
        className="w-auto min-w-32"
      >
        <option value="newest">Newest first</option>
        <option value="oldest">Oldest first</option>
        <option value="priority">By priority</option>
      </NativeSelect>

      {hasFilters ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setQuery('');
            router.push(pathname);
          }}
        >
          <X aria-hidden className="size-3.5" />
          Clear
        </Button>
      ) : null}
    </div>
  );
}
