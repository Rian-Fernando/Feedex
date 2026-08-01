import type { Metadata } from 'next';

import { requireWorkspace } from '@/lib/auth';
import { DashboardShell } from '@/components/dashboard/shell';
import { listUserWorkspaces } from '@/server/services/workspaces';
import { getWorkspaceStats } from '@/server/services/feedback';

export const metadata: Metadata = {
  // The dashboard is behind auth and must never appear in an index.
  robots: { index: false, follow: false },
};

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const context = await requireWorkspace();

  const [workspaces, stats] = await Promise.all([
    listUserWorkspaces(context.user.id),
    getWorkspaceStats(context.workspaceId),
  ]);

  return (
    <DashboardShell
      workspaces={workspaces}
      activeWorkspaceId={context.workspaceId}
      user={{ name: context.user.name, email: context.user.email }}
      openCount={stats.openFeedback}
      projectCount={stats.projects}
    >
      {children}
    </DashboardShell>
  );
}
