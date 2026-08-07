'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ChevronsUpDown,
  Check,
  FolderKanban,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Settings,
} from 'lucide-react';

import { cn } from '@/lib/cn';
import { Logo } from '@/components/brand/logo';
import { Menu, MenuContent, MenuItem, MenuLabel, MenuTrigger } from '@/components/ui/menu';
import { logoutAction } from '@/server/actions/auth';
import { switchWorkspaceAction } from '@/server/actions/settings';
import type { WorkspaceRole } from '@/lib/db/schema';

export interface NavWorkspace {
  id: string;
  name: string;
  slug: string;
  role: WorkspaceRole;
}

export interface SidebarProps {
  workspaces: NavWorkspace[];
  activeWorkspaceId: string;
  user: { name: string; email: string };
  openCount: number;
  projectCount: number;
}

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard, exact: true },
  { href: '/dashboard/projects', label: 'Projects', icon: FolderKanban, badge: 'projectCount' },
  { href: '/dashboard/feedback', label: 'Feedback', icon: MessageSquare, badge: 'openCount' },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings },
] as const;

/**
 * Primary navigation.
 *
 * Rendered inside both the fixed desktop rail and the mobile drawer, so it
 * takes its data as props and holds no layout assumptions of its own.
 */
export function SidebarNav({
  workspaces,
  activeWorkspaceId,
  user,
  openCount,
  projectCount,
  onNavigate,
  collapsed = false,
}: SidebarProps & { onNavigate?: () => void; collapsed?: boolean }) {
  const pathname = usePathname();
  const active = workspaces.find((w) => w.id === activeWorkspaceId);
  const counts = { openCount, projectCount };

  return (
    <div className="flex h-full flex-col gap-1">
      <div className={cn('py-4', collapsed ? 'px-2' : 'px-3')}>
        <Link
          href="/"
          className={cn('mb-4 inline-flex', collapsed ? 'justify-center px-0' : 'px-2')}
          aria-label="Feedex home"
          onClick={onNavigate}
        >
          {/* The wordmark does not fit a 60px rail; the mark alone does. */}
          <Logo className="text-[26px]" showWordmark={!collapsed} />
        </Link>

        <Menu>
          <MenuTrigger
            aria-label={collapsed ? `Workspace: ${active?.name ?? 'Workspace'}` : undefined}
            title={collapsed ? (active?.name ?? 'Workspace') : undefined}
            className={cn(
              'flex w-full items-center rounded-lg border border-line bg-surface-raised py-2 hover:border-line-strong',
              'text-left transition-colors',
              collapsed ? 'justify-center px-0' : 'gap-2 px-2.5',
            )}
          >
            <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-accent-600 text-[0.6875rem] font-semibold text-white">
              {active?.name.slice(0, 1).toUpperCase() ?? 'W'}
            </span>
            {!collapsed ? (
              <>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-fg">
                    {active?.name ?? 'Workspace'}
                  </span>
                  <span className="block truncate text-xs text-fg-subtle capitalize">
                    {active?.role ?? 'member'}
                  </span>
                </span>
                <ChevronsUpDown aria-hidden className="size-3.5 shrink-0 text-fg-subtle" />
              </>
            ) : null}
          </MenuTrigger>

          <MenuContent align="start" className="w-56">
            <MenuLabel>Workspaces</MenuLabel>
            {workspaces.map((workspace) => (
              <MenuItem
                key={workspace.id}
                onSelect={() => void switchWorkspaceAction(workspace.id)}
                className="justify-between"
              >
                <span className="truncate">{workspace.name}</span>
                {workspace.id === activeWorkspaceId ? (
                  <Check aria-hidden className="size-3.5 shrink-0 text-accent-500" />
                ) : null}
              </MenuItem>
            ))}
          </MenuContent>
        </Menu>
      </div>

      <nav aria-label="Main" className={cn('flex-1', collapsed ? 'px-2' : 'px-3')}>
        <ul className="flex flex-col gap-0.5">
          {NAV_ITEMS.map((item) => {
            const isActive =
              'exact' in item && item.exact
                ? pathname === item.href
                : pathname.startsWith(item.href);

            const count = 'badge' in item ? counts[item.badge as keyof typeof counts] : undefined;

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={isActive ? 'page' : undefined}
                  // Collapsed, the icon is the only visible content, so the
                  // label has to survive as the accessible name.
                  aria-label={collapsed ? item.label : undefined}
                  title={collapsed ? item.label : undefined}
                  className={cn(
                    'relative flex items-center rounded-lg py-2 text-sm font-medium transition-colors',
                    collapsed ? 'justify-center px-0' : 'gap-2.5 px-2.5',
                    isActive
                      ? 'bg-surface-inset text-fg'
                      : 'text-fg-muted hover:bg-surface-inset/60 hover:text-fg',
                  )}
                >
                  <item.icon aria-hidden className="size-4 shrink-0" />
                  {collapsed ? (
                    // A dot rather than a number: the count does not fit, but
                    // "there is something here" still needs to carry.
                    count ? (
                      <span
                        aria-hidden
                        className="absolute top-1 right-1 size-1.5 rounded-full bg-accent-500"
                      />
                    ) : null
                  ) : (
                    <>
                      <span className="flex-1">{item.label}</span>
                      {count ? (
                        <span className="rounded-full bg-surface-sunken px-1.5 py-0.5 text-2xs font-medium text-fg-subtle tabular-nums">
                          {count}
                        </span>
                      ) : null}
                    </>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className={cn('border-t border-line-subtle', collapsed ? 'p-2' : 'p-3')}>
        <Menu>
          <MenuTrigger
            aria-label={collapsed ? `Account: ${user.name}` : undefined}
            title={collapsed ? user.name : undefined}
            className={cn(
              'flex w-full items-center rounded-lg py-2 text-left transition-colors hover:bg-surface-inset',
              collapsed ? 'justify-center px-0' : 'gap-2.5 px-2.5',
            )}
          >
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-surface-sunken text-xs font-semibold text-fg-muted">
              {user.name.slice(0, 1).toUpperCase()}
            </span>
            {!collapsed ? (
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-fg">{user.name}</span>
                <span className="block truncate text-xs text-fg-subtle">{user.email}</span>
              </span>
            ) : null}
          </MenuTrigger>

          {/*
            Sign out only. Settings is a primary destination in the nav above,
            and offering a second door to the same page made the account menu
            look like it led somewhere else.
          */}
          <MenuContent align="start" side="top" className="w-56">
            <MenuItem destructive onSelect={() => void logoutAction()}>
              <LogOut aria-hidden className="size-3.5" />
              Sign out
            </MenuItem>
          </MenuContent>
        </Menu>
      </div>
    </div>
  );
}
