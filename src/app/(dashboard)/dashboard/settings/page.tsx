import type { Metadata } from 'next';
import { Database } from 'lucide-react';

import { can, requireWorkspace } from '@/lib/auth';
import { databaseDriver } from '@/lib/db';
import { getWorkspace, listInvitations, listMembers } from '@/server/services/workspaces';
import { MembersPanel } from '@/components/dashboard/members-panel';
import { getVocabulary } from '@/server/services/labels';
import { LabelManager } from '@/components/dashboard/label-manager';
import { PageHeader } from '@/components/dashboard/shell';
import {
  AppearanceForm,
  PasswordForm,
  ProfileForm,
  WorkspaceDangerZone,
  WorkspaceForm,
} from '@/components/dashboard/settings-forms';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/misc';
import { formatDate } from '@/lib/format';

export const metadata: Metadata = {
  title: 'Settings',
};

export default async function SettingsPage() {
  const context = await requireWorkspace();

  const [workspace, members, vocabulary, invitations] = await Promise.all([
    getWorkspace(context.workspaceId),
    listMembers(context.workspaceId),
    getVocabulary(context.workspaceId),
    listInvitations(context.workspaceId),
  ]);

  const canEditWorkspace = can(context.role, 'workspace.update');
  const canDeleteWorkspace = can(context.role, 'workspace.delete');

  return (
    <>
      <PageHeader title="Settings" description="Your account and this workspace." />

      <Tabs defaultValue="account">
        <TabsList>
          <TabsTrigger value="account">Account</TabsTrigger>
          <TabsTrigger value="workspace">Workspace</TabsTrigger>
          <TabsTrigger value="labels">Statuses &amp; categories</TabsTrigger>
          <TabsTrigger value="members">Members</TabsTrigger>
        </TabsList>

        <TabsContent value="account" className="flex max-w-2xl flex-col gap-4 pt-6">
          <ProfileForm user={{ name: context.user.name, email: context.user.email }} />
          <AppearanceForm />
          <PasswordForm />
        </TabsContent>

        <TabsContent value="labels" className="flex max-w-3xl flex-col gap-4 pt-6">
          <LabelManager
            kind="status"
            labels={vocabulary.statuses}
            canManage={can(context.role, 'project.update')}
          />
          <LabelManager
            kind="category"
            labels={vocabulary.categories}
            canManage={can(context.role, 'project.update')}
          />
        </TabsContent>

        <TabsContent value="workspace" className="flex max-w-2xl flex-col gap-4 pt-6">
          <WorkspaceForm
            name={context.workspaceName}
            settings={workspace?.settings ?? {}}
            canEdit={canEditWorkspace}
          />

          <Card>
            <CardHeader>
              <CardTitle>Instance</CardTitle>
              <CardDescription>How this deployment is configured.</CardDescription>
            </CardHeader>
            <CardContent className="pt-3">
              <dl className="flex flex-col gap-2.5">
                <div className="flex items-center justify-between gap-3">
                  <dt className="flex items-center gap-1.5 text-sm text-fg-subtle">
                    <Database aria-hidden className="size-3.5" />
                    Database
                  </dt>
                  <dd>
                    <Badge tone={databaseDriver() === 'postgres' ? 'success' : 'warning'} size="sm">
                      {databaseDriver() === 'postgres' ? 'PostgreSQL' : 'PGlite (local)'}
                    </Badge>
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-sm text-fg-subtle">Workspace created</dt>
                  <dd className="text-sm text-fg-muted">
                    {workspace ? formatDate(workspace.createdAt) : '—'}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          {canDeleteWorkspace ? (
            <WorkspaceDangerZone workspaceName={context.workspaceName} />
          ) : null}
        </TabsContent>

        <TabsContent value="members" className="flex max-w-2xl flex-col gap-4 pt-6">
          <MembersPanel
            members={members}
            invitations={invitations}
            currentUserId={context.user.id}
            currentRole={context.role}
            canManage={can(context.role, 'member.manage')}
          />
        </TabsContent>
      </Tabs>
    </>
  );
}
