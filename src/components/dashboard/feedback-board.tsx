'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { cn } from '@/lib/cn';
import { Badge } from '@/components/ui/badge';
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@/components/ui/menu';
import { asTone, priorityMeta } from '@/lib/taxonomy';
import { timeAgo } from '@/lib/format';
import { updateFeedbackAction } from '@/server/actions/feedback';
import type { FeedbackWithProject } from '@/server/services/feedback';
import type { FeedbackStatus } from '@/lib/db/schema';

/**
 * Board view of the feedback queue.
 *
 * The list view answers "what came in"; this answers "what is in flight", which
 * is the question you actually have when several things are half-done. Columns
 * are the workflow statuses, and a card is dragged between them to move it.
 *
 * Two things this deliberately does not do:
 *
 *   - It does not pull in a drag-and-drop library. The interaction here is one
 *     card onto one column, which the native HTML drag events already describe,
 *     and the smallest of those libraries costs more than the whole widget.
 *   - It does not rely on dragging alone. Native drag-and-drop is unusable from
 *     a keyboard and unreliable on touch, so every card also carries a menu
 *     that moves it. The pointer gesture is the shortcut, not the only route.
 *
 * Moves are optimistic: the card jumps immediately and is put back if the
 * server refuses, because a board that waits for a round trip before the card
 * lands feels broken.
 */

export interface FeedbackBoardProps {
  items: FeedbackWithProject[];
  /** The workspace's own statuses, in display order. One column each. */
  statuses: Array<{ id: string; key: string; label: string; tone: string }>;
  /** Whether the signed-in member may actually move cards. */
  canUpdate: boolean;
}

/** Cards rendered per column before the rest are summarised. */
const COLUMN_LIMIT = 50;

export function FeedbackBoard({ items, statuses, canUpdate }: FeedbackBoardProps) {
  const router = useRouter();

  const [dragging, setDragging] = React.useState<string | null>(null);
  const [over, setOver] = React.useState<FeedbackStatus | null>(null);

  /*
    The server list is the source of truth, with in-flight moves layered over
    it. `useOptimistic` is the right primitive rather than a state copy kept in
    sync by an effect: it discards the overlay on its own when the transition
    ends, so a rejected move snaps back without any bookkeeping, and fresh
    server data always wins.
  */
  const [optimistic, applyMove] = React.useOptimistic(
    items,
    (current, move: { id: string; status: FeedbackStatus }) =>
      current.map((item) => (item.id === move.id ? { ...item, status: move.status } : item)),
  );

  const move = React.useCallback(
    (item: FeedbackWithProject, status: FeedbackStatus) => {
      if (!canUpdate || item.status === status) return;

      // The optimistic update has to happen inside the transition that owns the
      // await, or React has no scope in which to hold and then release it.
      React.startTransition(async () => {
        applyMove({ id: item.id, status });

        const result = await updateFeedbackAction(item.id, { status });

        if (!result.ok) {
          toast.error(result.error ?? 'That change could not be saved.');
          return;
        }

        // Refreshed rather than trusted: moving into a closed status also
        // stamps `resolvedAt`, and the counts in the header change with it.
        router.refresh();
      });
    },
    [canUpdate, applyMove, router],
  );

  const columns = statuses.map((status) => ({
    ...status,
    items: optimistic.filter((item) => item.status === status.key),
  }));

  return (
    <div className="-mx-1 flex snap-x scrollbar-thin gap-3 overflow-x-auto px-1 pb-2">
      {columns.map((column) => {
        const visible = column.items.slice(0, COLUMN_LIMIT);
        const overflow = column.items.length - visible.length;

        return (
          <section
            key={column.key}
            aria-label={`${column.label}, ${column.items.length} items`}
            onDragOver={(event) => {
              if (!canUpdate || !dragging) return;
              // Without this the drop never fires: the default handling of
              // dragover is to reject the drop.
              event.preventDefault();
              setOver(column.key);
            }}
            onDragLeave={() => setOver((current) => (current === column.key ? null : current))}
            onDrop={(event) => {
              event.preventDefault();
              setOver(null);
              const id = event.dataTransfer.getData('text/plain');
              const item = optimistic.find((entry) => entry.id === id);
              if (item) move(item, column.key);
            }}
            className={cn(
              'flex w-[17.5rem] shrink-0 snap-start flex-col rounded-xl border transition-colors',
              over === column.key
                ? 'border-accent-500 bg-accent-500/5'
                : 'border-line-subtle bg-surface-sunken/40',
            )}
          >
            <header className="flex items-center justify-between gap-2 px-3 py-2.5">
              <div className="flex items-center gap-2">
                <Badge tone={asTone(column.tone)} dot size="sm">
                  {column.label}
                </Badge>
              </div>
              <span className="text-2xs font-medium text-fg-subtle tabular-nums">
                {column.items.length}
              </span>
            </header>

            <div className="flex min-h-24 flex-1 flex-col gap-2 px-2 pb-2">
              {visible.map((item) => (
                <BoardCard
                  key={item.id}
                  item={item}
                  statuses={statuses}
                  status={item.status}
                  canUpdate={canUpdate}
                  dragging={dragging === item.id}
                  onDragStart={(event) => {
                    event.dataTransfer.setData('text/plain', item.id);
                    event.dataTransfer.effectAllowed = 'move';
                    setDragging(item.id);
                  }}
                  onDragEnd={() => {
                    setDragging(null);
                    setOver(null);
                  }}
                  onMove={(status) => move(item, status)}
                />
              ))}

              {column.items.length === 0 ? (
                <p className="px-1 py-6 text-center text-xs text-fg-subtle">Nothing here</p>
              ) : null}

              {overflow > 0 ? (
                <p className="px-1 pt-1 text-center text-xs text-fg-subtle">
                  and {overflow} more — narrow the filters to see them
                </p>
              ) : null}
            </div>
          </section>
        );
      })}
    </div>
  );
}

interface BoardCardProps {
  item: FeedbackWithProject;
  statuses: FeedbackBoardProps['statuses'];
  status: FeedbackStatus;
  canUpdate: boolean;
  dragging: boolean;
  onDragStart: (event: React.DragEvent) => void;
  onDragEnd: () => void;
  onMove: (status: FeedbackStatus) => void;
}

function BoardCard({
  item,
  statuses,
  status,
  canUpdate,
  dragging,
  onDragStart,
  onDragEnd,
  onMove,
}: BoardCardProps) {
  const priority = priorityMeta(item.priority);

  return (
    <article
      draggable={canUpdate}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={cn(
        'group rounded-lg border border-line-subtle bg-surface-raised p-2.5 transition-all',
        canUpdate && 'cursor-grab active:cursor-grabbing',
        dragging ? 'opacity-40' : 'hover:border-line-strong',
      )}
    >
      <div className="flex items-start justify-between gap-1.5">
        <Link
          href={`/dashboard/feedback/${item.id}`}
          className="line-clamp-3 text-[0.8125rem] leading-snug font-medium text-fg transition-colors hover:text-accent-500"
        >
          {item.title}
        </Link>

        {canUpdate ? (
          <Menu>
            <MenuTrigger
              aria-label={`Move ${item.title}`}
              className="-mt-0.5 -mr-0.5 shrink-0 rounded p-1 text-fg-subtle opacity-0 transition-opacity group-hover:opacity-100 hover:bg-surface-inset hover:text-fg focus-visible:opacity-100 data-[state=open]:opacity-100"
            >
              {/* Three dots, drawn rather than imported: one glyph, one path. */}
              <svg viewBox="0 0 16 16" aria-hidden className="size-3.5" fill="currentColor">
                <circle cx="8" cy="3" r="1.4" />
                <circle cx="8" cy="8" r="1.4" />
                <circle cx="8" cy="13" r="1.4" />
              </svg>
            </MenuTrigger>

            <MenuContent align="end" className="w-44">
              {statuses
                .filter((entry) => entry.key !== status)
                .map((entry) => (
                  <MenuItem key={entry.key} onSelect={() => onMove(entry.key)}>
                    Move to {entry.label.toLowerCase()}
                  </MenuItem>
                ))}
            </MenuContent>
          </Menu>
        ) : null}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <Badge tone={asTone(item.categoryTone)} size="sm">
          {item.categoryLabel}
        </Badge>
        {/* Only the priorities worth interrupting for get a chip; medium and
            low on every card would be noise. */}
        {item.priority === 'high' || item.priority === 'critical' ? (
          <Badge tone={priority.tone} size="sm">
            {priority.label}
          </Badge>
        ) : null}
      </div>

      <div className="mt-2 flex items-center justify-between gap-2 text-[0.6875rem] text-fg-subtle">
        <span className="flex min-w-0 items-center gap-1.5">
          <span
            aria-hidden
            className="size-1.5 shrink-0 rounded-full"
            style={{ backgroundColor: item.projectColor }}
          />
          <span className="truncate">{item.projectName}</span>
        </span>
        <span className="shrink-0">{timeAgo(item.createdAt)}</span>
      </div>
    </article>
  );
}
