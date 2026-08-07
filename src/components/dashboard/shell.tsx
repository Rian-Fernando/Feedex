'use client';

import * as React from 'react';
import { Dialog as RadixDialog } from 'radix-ui';
import { Menu as MenuIcon, PanelLeftClose, PanelLeftOpen, X } from 'lucide-react';

import { cn } from '@/lib/cn';
import { SidebarNav, type SidebarProps } from './sidebar';
import { ThemeToggle } from './theme-toggle';
import { SearchCommand } from './search-command';
import { useBooleanPreference } from '@/lib/local-preference';

/**
 * Dashboard chrome.
 *
 * One fixed rail on large screens, the same navigation inside a drawer below
 * `lg`. The drawer is a Radix dialog so it inherits focus trapping and Escape
 * handling rather than reimplementing them.
 */
export function DashboardShell({ children, ...nav }: SidebarProps & { children: React.ReactNode }) {
  const [drawerOpen, setDrawerOpen] = React.useState(false);

  /*
    Collapsing the rail is not decoration: the board wants every pixel it can
    get, and 15rem of navigation is a whole column. The preference persists, so
    someone who works on the board keeps the width without re-collapsing it on
    every visit.
  */
  const [collapsed, setCollapsed] = useBooleanPreference('feedex-sidebar-collapsed');

  return (
    <div className="min-h-dvh">
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-30 hidden border-r border-line-subtle bg-surface-raised',
          'transition-[width] duration-200 lg:block',
          collapsed ? 'w-[3.75rem]' : 'w-60',
        )}
      >
        <SidebarNav {...nav} collapsed={collapsed} />
      </aside>

      <div
        className={cn(
          'transition-[padding] duration-200',
          collapsed ? 'lg:pl-[3.75rem]' : 'lg:pl-60',
        )}
      >
        <header
          className={cn(
            'sticky top-0 z-20 border-b border-line-subtle bg-surface/85 backdrop-blur-md',
            'flex h-14 items-center gap-3 px-4 sm:px-6',
          )}
        >
          <RadixDialog.Root open={drawerOpen} onOpenChange={setDrawerOpen}>
            <RadixDialog.Trigger
              className="-ml-1.5 inline-flex size-9 items-center justify-center rounded-lg text-fg-muted transition-colors hover:bg-surface-inset hover:text-fg lg:hidden"
              aria-label="Open navigation"
            >
              <MenuIcon aria-hidden className="size-4.5" />
            </RadixDialog.Trigger>

            <RadixDialog.Portal>
              <RadixDialog.Overlay className="fixed inset-0 z-40 bg-plum-950/50 backdrop-blur-sm data-[state=closed]:animate-overlay-out data-[state=open]:animate-overlay-in lg:hidden" />
              <RadixDialog.Content
                className={cn(
                  'fixed inset-y-0 left-0 z-50 w-64 border-r border-line-subtle bg-surface-raised lg:hidden',
                  'data-[state=closed]:animate-overlay-out data-[state=open]:animate-overlay-in',
                )}
              >
                <RadixDialog.Title className="sr-only">Navigation</RadixDialog.Title>
                <RadixDialog.Close
                  className="absolute top-4 right-3 inline-flex size-8 items-center justify-center rounded-md text-fg-subtle hover:bg-surface-inset"
                  aria-label="Close navigation"
                >
                  <X aria-hidden className="size-4" />
                </RadixDialog.Close>
                <SidebarNav {...nav} onNavigate={() => setDrawerOpen(false)} />
              </RadixDialog.Content>
            </RadixDialog.Portal>
          </RadixDialog.Root>

          {/* Desktop only: below lg the rail is a drawer, which has no collapsed state. */}
          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            aria-pressed={collapsed}
            aria-label={collapsed ? 'Expand the navigation' : 'Collapse the navigation'}
            title={collapsed ? 'Expand the navigation' : 'Collapse the navigation'}
            className="-ml-1.5 hidden size-9 items-center justify-center rounded-lg text-fg-muted transition-colors hover:bg-surface-inset hover:text-fg lg:inline-flex"
          >
            {collapsed ? (
              <PanelLeftOpen aria-hidden className="size-4.5" />
            ) : (
              <PanelLeftClose aria-hidden className="size-4.5" />
            )}
          </button>

          <SearchCommand />

          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />
          </div>
        </header>

        {/*
          The width cap lifts with the rail. Someone who collapsed the
          navigation did it to get room, and holding the content at 80rem
          would have handed that room straight back as empty margin.
        */}
        <main id="main" className="px-4 py-6 sm:px-6 lg:px-8">
          <div className={cn('mx-auto', collapsed ? 'max-w-none' : 'max-w-7xl')}>{children}</div>
        </main>
      </div>
    </div>
  );
}

/** Consistent page heading used at the top of every dashboard route. */
export function PageHeader({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between',
        className,
      )}
    >
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight text-fg">{title}</h1>
        {description ? <p className="text-sm text-fg-muted">{description}</p> : null}
      </div>
      {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
    </div>
  );
}
