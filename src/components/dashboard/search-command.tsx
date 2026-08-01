'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Dialog as RadixDialog } from 'radix-ui';
import { FolderKanban, MessageSquare, Search } from 'lucide-react';

import { cn } from '@/lib/cn';
import { searchAction, type SearchHit } from '@/server/actions/search';

/**
 * Command palette.
 *
 * Opens on ⌘K / Ctrl-K. Results are fetched from a server action with a short
 * debounce, and a request counter discards responses that arrive out of order
 * so a slow early query cannot overwrite a fast later one.
 */
export function SearchCommand() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [results, setResults] = React.useState<SearchHit[]>([]);
  const [activeIndex, setActiveIndex] = React.useState(0);
  const [pending, startTransition] = React.useTransition();
  const requestId = React.useRef(0);

  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((value) => !value);
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const tooShort = query.trim().length < 2;

  React.useEffect(() => {
    if (tooShort) {
      // Invalidate any in-flight request so a late response cannot repopulate
      // the list after the user has cleared the box.
      requestId.current += 1;
      return;
    }

    const id = ++requestId.current;
    const timer = setTimeout(() => {
      startTransition(async () => {
        const hits = await searchAction(query);
        // Ignore a response that a newer keystroke has already superseded.
        if (id === requestId.current) {
          setResults(hits);
          setActiveIndex(0);
        }
      });
    }, 180);

    return () => clearTimeout(timer);
  }, [query, tooShort]);

  // Results belong to the current query; a stale list must never be shown
  // while the box is empty or below the minimum length.
  const visible = tooShort ? [] : results;

  function go(hit: SearchHit) {
    setOpen(false);
    router.push(hit.href);
  }

  function onInputKeyDown(event: React.KeyboardEvent) {
    if (visible.length === 0) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % visible.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) => (index - 1 + visible.length) % visible.length);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const hit = visible[activeIndex];
      if (hit) go(hit);
    }
  }

  return (
    <RadixDialog.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        // Reset here rather than in an effect: closing is an event, and
        // clearing in response to it avoids an extra render pass.
        if (!next) {
          setQuery('');
          setResults([]);
          setActiveIndex(0);
        }
      }}
    >
      <RadixDialog.Trigger
        className={cn(
          'flex h-9 items-center gap-2 rounded-lg border border-line bg-surface-raised px-3 text-fg-subtle hover:border-line-strong',
          'w-full max-w-xs text-sm transition-colors sm:max-w-sm',
        )}
      >
        <Search aria-hidden className="size-3.5 shrink-0" />
        <span className="flex-1 text-left">Search…</span>
        <kbd className="hidden rounded border border-line bg-surface-inset px-1.5 py-0.5 font-sans text-2xs sm:inline-block">
          ⌘K
        </kbd>
      </RadixDialog.Trigger>

      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-50 bg-plum-950/50 backdrop-blur-sm data-[state=closed]:animate-overlay-out data-[state=open]:animate-overlay-in" />
        <RadixDialog.Content
          className={cn(
            'fixed top-[15vh] left-1/2 z-50 w-[calc(100vw-2rem)] max-w-lg border-line bg-surface-overlay shadow-overlay',
            '-translate-x-1/2 overflow-hidden rounded-xl border',
            'data-[state=closed]:animate-overlay-out data-[state=open]:animate-popover-in',
          )}
        >
          <RadixDialog.Title className="sr-only">Search</RadixDialog.Title>
          <RadixDialog.Description className="sr-only">
            Search feedback and projects in this workspace.
          </RadixDialog.Description>

          <div className="flex items-center gap-2.5 border-b border-line-subtle px-4">
            <Search aria-hidden className="size-4 shrink-0 text-fg-subtle" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={onInputKeyDown}
              placeholder="Search feedback and projects…"
              aria-label="Search feedback and projects"
              autoComplete="off"
              className="h-12 flex-1 bg-transparent text-sm text-fg outline-none placeholder:text-fg-subtle"
            />
          </div>

          <div className="max-h-80 scrollbar-thin overflow-y-auto p-2">
            {tooShort ? (
              <p className="px-2 py-6 text-center text-sm text-fg-subtle">
                Type at least two characters to search.
              </p>
            ) : visible.length === 0 ? (
              <p className="px-2 py-6 text-center text-sm text-fg-subtle">
                {pending ? 'Searching…' : 'No matches found.'}
              </p>
            ) : (
              <ul role="listbox" aria-label="Search results" className="flex flex-col gap-0.5">
                {visible.map((hit, index) => (
                  <li key={`${hit.type}-${hit.id}`}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={index === activeIndex}
                      onClick={() => go(hit)}
                      onMouseEnter={() => setActiveIndex(index)}
                      className={cn(
                        'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors',
                        index === activeIndex ? 'bg-surface-inset' : 'hover:bg-surface-inset/60',
                      )}
                    >
                      {hit.type === 'project' ? (
                        <FolderKanban aria-hidden className="size-4 shrink-0 text-fg-subtle" />
                      ) : (
                        <MessageSquare aria-hidden className="size-4 shrink-0 text-fg-subtle" />
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-fg">{hit.title}</span>
                        <span className="block truncate text-xs text-fg-subtle">
                          {hit.subtitle}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
