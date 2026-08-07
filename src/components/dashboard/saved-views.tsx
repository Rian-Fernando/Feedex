'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { BookmarkPlus, X } from 'lucide-react';
import { toast } from 'sonner';

import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';
import { createViewAction, deleteViewAction } from '@/server/actions/views';

/**
 * Saved filter combinations.
 *
 * A view is just the current query string under a name, so it composes with
 * every filter automatically and needs no schema change when a new one is
 * added. Rendered as links rather than buttons: they are destinations, so they
 * open in a new tab, can be copied, and work with the back button.
 */

export interface SavedViewsProps {
  views: Array<{ id: string; name: string; query: string }>;
}

export function SavedViews({ views }: SavedViewsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = React.useTransition();

  const current = params.toString();

  // `page` is excluded when saving, so it must be excluded when comparing or a
  // view would stop looking active the moment you paged.
  const normalised = React.useMemo(() => {
    const next = new URLSearchParams(current);
    next.delete('page');
    return next.toString();
  }, [current]);

  const save = () => {
    const name = window.prompt('Name this view', 'My open bugs');
    if (!name?.trim()) return;

    startTransition(async () => {
      const result = await createViewAction(name, current);

      if (!result.ok) {
        toast.error(result.error ?? 'That view could not be saved.');
        return;
      }

      toast.success('View saved');
      router.refresh();
    });
  };

  const hasFilters = normalised.length > 0;

  if (views.length === 0 && !hasFilters) return null;

  return (
    <div className="mb-3 flex flex-wrap items-center gap-1.5">
      {views.map((view) => {
        const active = view.query === normalised;

        return (
          <span key={view.id} className="group/view relative inline-flex">
            <Link
              href={view.query ? `${pathname}?${view.query}` : pathname}
              className={cn(
                'rounded-full border py-1 pr-6 pl-2.5 text-xs font-medium transition-colors',
                active
                  ? 'border-accent-500 bg-accent-500/10 text-accent-500'
                  : 'border-line text-fg-muted hover:border-line-strong hover:text-fg',
              )}
            >
              {view.name}
            </Link>
            <button
              type="button"
              aria-label={`Delete the ${view.name} view`}
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const result = await deleteViewAction(view.id);
                  if (!result.ok) {
                    toast.error(result.error ?? 'That view could not be deleted.');
                    return;
                  }
                  router.refresh();
                })
              }
              className="absolute top-1/2 right-1.5 -translate-y-1/2 rounded p-0.5 text-fg-subtle opacity-0 transition-opacity group-hover/view:opacity-100 hover:text-danger-500 focus-visible:opacity-100"
            >
              <X aria-hidden className="size-2.5" />
            </button>
          </span>
        );
      })}

      {/* Offered only when there is something to save — an empty filter set is
          not a view, it is the default. */}
      {hasFilters ? (
        <Button variant="ghost" size="sm" onClick={save} loading={pending} className="h-7 text-xs">
          <BookmarkPlus aria-hidden className="size-3.5" />
          Save this view
        </Button>
      ) : null}
    </div>
  );
}
