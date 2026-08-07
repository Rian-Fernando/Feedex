'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/field';
import { FeedbackRow } from '@/components/dashboard/feedback-row';
import { bulkDeleteAction, bulkUpdateAction } from '@/server/actions/bulk';
import type { FeedbackWithProject } from '@/server/services/feedback';

/**
 * The feedback list, with selection.
 *
 * Triage is repetitive by nature — twenty reports of the same thing after a bad
 * deploy — and doing it one item at a time means twenty page loads. Selecting a
 * range and setting a status once is the difference between the queue being
 * maintained and being ignored.
 *
 * Shift-click extends from the last item clicked, which is the behaviour people
 * already expect from every file manager and mail client. Without it, selecting
 * forty consecutive items means forty clicks and the feature does not get used.
 */

export interface FeedbackListProps {
  items: FeedbackWithProject[];
  statuses: Array<{ key: string; label: string }>;
  categories: Array<{ key: string; label: string }>;
  canUpdate: boolean;
  canDelete: boolean;
}

const PRIORITIES = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
];

export function FeedbackList({
  items,
  statuses,
  categories,
  canUpdate,
  canDelete,
}: FeedbackListProps) {
  const router = useRouter();
  const [selected, setSelected] = React.useState<string[]>([]);
  const [pending, startTransition] = React.useTransition();
  const lastClicked = React.useRef<number | null>(null);

  // Anything selected that is no longer on screen — because the list was
  // filtered or refreshed — must not stay in the selection.
  const visible = React.useMemo(() => new Set(items.map((item) => item.id)), [items]);
  const active = selected.filter((id) => visible.has(id));

  const allSelected = items.length > 0 && active.length === items.length;

  const toggle = (id: string, index: number, shiftKey: boolean) => {
    setSelected((current) => {
      if (shiftKey && lastClicked.current !== null) {
        const from = Math.min(lastClicked.current, index);
        const to = Math.max(lastClicked.current, index);
        const range = items.slice(from, to + 1).map((item) => item.id);
        return Array.from(new Set([...current, ...range]));
      }

      lastClicked.current = index;
      return current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id];
    });
  };

  const run = (action: Promise<{ ok: boolean; error?: string; data?: number }>, verb: string) => {
    startTransition(async () => {
      const result = await action;

      if (!result.ok) {
        toast.error(result.error ?? 'That change could not be applied.');
        return;
      }

      // Reports the number the server actually touched rather than the number
      // selected — those differ when something changed underneath, and that is
      // exactly the case worth surfacing.
      toast.success(`${result.data ?? 0} ${result.data === 1 ? 'item' : 'items'} ${verb}`);
      setSelected([]);
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col">
      {active.length > 0 ? (
        <div className="sticky top-14 z-10 -mx-2 mb-1 flex flex-wrap items-center gap-2 rounded-lg border border-line-subtle bg-surface-inset/60 px-3 py-2 backdrop-blur-sm">
          <span className="text-sm font-medium text-fg tabular-nums">{active.length} selected</span>

          {canUpdate ? (
            <>
              <NativeSelect
                aria-label="Set status"
                value=""
                disabled={pending}
                onChange={(event) =>
                  event.target.value &&
                  run(bulkUpdateAction(active, { status: event.target.value }), 'moved')
                }
                className="h-8 w-auto min-w-28 text-xs"
              >
                <option value="">Set status…</option>
                {statuses.map((status) => (
                  <option key={status.key} value={status.key}>
                    {status.label}
                  </option>
                ))}
              </NativeSelect>

              <NativeSelect
                aria-label="Set priority"
                value=""
                disabled={pending}
                onChange={(event) =>
                  event.target.value &&
                  run(bulkUpdateAction(active, { priority: event.target.value }), 'updated')
                }
                className="h-8 w-auto min-w-28 text-xs"
              >
                <option value="">Set priority…</option>
                {PRIORITIES.map((priority) => (
                  <option key={priority.value} value={priority.value}>
                    {priority.label}
                  </option>
                ))}
              </NativeSelect>

              <NativeSelect
                aria-label="Set category"
                value=""
                disabled={pending}
                onChange={(event) =>
                  event.target.value &&
                  run(bulkUpdateAction(active, { category: event.target.value }), 'recategorised')
                }
                className="h-8 w-auto min-w-32 text-xs"
              >
                <option value="">Set category…</option>
                {categories.map((category) => (
                  <option key={category.key} value={category.key}>
                    {category.label}
                  </option>
                ))}
              </NativeSelect>
            </>
          ) : null}

          <div className="ml-auto flex items-center gap-2">
            {canDelete ? (
              <Button
                variant="ghost"
                size="sm"
                disabled={pending}
                className="text-danger-500 hover:text-danger-500"
                onClick={() => {
                  if (
                    // The one irreversible action here, so it asks. Everything
                    // else can simply be set back.
                    window.confirm(
                      `Delete ${active.length} ${active.length === 1 ? 'report' : 'reports'}? This cannot be undone.`,
                    )
                  ) {
                    run(bulkDeleteAction(active), 'deleted');
                  }
                }}
              >
                Delete
              </Button>
            ) : null}
            <Button variant="ghost" size="sm" onClick={() => setSelected([])}>
              Clear
            </Button>
          </div>
        </div>
      ) : null}

      <label className="flex w-fit cursor-pointer items-center gap-2 px-2 py-1.5 text-xs text-fg-subtle transition-colors hover:text-fg-muted">
        <input
          type="checkbox"
          checked={allSelected}
          onChange={() => setSelected(allSelected ? [] : items.map((item) => item.id))}
          className="size-3.5 cursor-pointer accent-accent-500"
        />
        Select all on this page
      </label>

      <ul className="divide-y divide-line-subtle">
        {items.map((item, index) => {
          const checked = active.includes(item.id);

          return (
            <li
              key={item.id}
              className={cn('flex items-start gap-1', checked && 'bg-accent-500/5')}
            >
              <label className="cursor-pointer py-4 pl-2">
                <span className="sr-only">Select {item.title}</span>
                <input
                  type="checkbox"
                  checked={checked}
                  onClick={(event) => toggle(item.id, index, event.shiftKey)}
                  onChange={() => {
                    // Handled in onClick, which is the only place the shift key
                    // is observable.
                  }}
                  className="size-3.5 cursor-pointer accent-accent-500"
                />
              </label>
              <div className="min-w-0 flex-1">
                <FeedbackRow item={item} />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
