import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ArrowLeft, ExternalLink, Inbox } from 'lucide-react';

import { requireWorkspace } from '@/lib/auth';
import { absoluteUrl } from '@/config/site';
import { getProject, isProjectConnected, listApiKeys } from '@/server/services/projects';
import { listFeedback } from '@/server/services/feedback';
import { getVocabulary } from '@/server/services/labels';
import { PageHeader } from '@/components/dashboard/shell';
import { InstallSnippet } from '@/components/dashboard/install-snippet';
import { ApiKeysPanel } from '@/components/dashboard/api-keys-panel';
import {
  ProjectDangerZone,
  ProjectSettingsForm,
  WidgetSettingsForm,
} from '@/components/dashboard/project-settings-forms';
import { FeedbackRow } from '@/components/dashboard/feedback-row';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState, Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/misc';
import { environmentMeta, projectStatusMeta } from '@/lib/taxonomy';
import { timeAgo } from '@/lib/format';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const context = await requireWorkspace();
  const project = await getProject(context.workspaceId, (await params).id);
  return { title: project?.name ?? 'Project' };
}

export default async function ProjectDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const context = await requireWorkspace();
  const { id } = await params;
  const query = await searchParams;

  const project = await getProject(context.workspaceId, id);
  if (!project) notFound();

  const [keys, feedback, connection, vocabulary] = await Promise.all([
    listApiKeys(context.workspaceId, project.id),
    listFeedback(context.workspaceId, {
      projectId: project.id,
      sort: 'newest',
      page: 1,
      perPage: 8,
    }),
    isProjectConnected(context.workspaceId, project.id),
    getVocabulary(context.workspaceId),
  ]);

  const publicKey = keys.find((key) => key.type === 'public')?.publicValue ?? '';
  const environment = environmentMeta(project.environment);
  const status = projectStatusMeta(project.status);

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="mb-3 -ml-2">
        <Link href="/dashboard/projects">
          <ArrowLeft aria-hidden className="size-3.5" />
          Projects
        </Link>
      </Button>

      <PageHeader
        title={project.name}
        description={project.description ?? undefined}
        action={
          project.domain ? (
            <Button asChild variant="secondary" size="sm">
              <a href={`https://${project.domain}`} target="_blank" rel="noopener noreferrer">
                Visit site
                <ExternalLink aria-hidden className="size-3.5" />
              </a>
            </Button>
          ) : null
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <Badge tone={status.tone} dot>
          {status.label}
        </Badge>
        <Badge tone={environment.tone}>{environment.label}</Badge>
        {project.domain ? (
          <span className="text-xs text-fg-subtle">{project.domain}</span>
        ) : (
          <span className="text-xs text-fg-subtle">No domain restriction</span>
        )}
      </div>

      <Tabs defaultValue={query.created === '1' ? 'install' : 'feedback'}>
        <TabsList>
          <TabsTrigger value="feedback">Feedback</TabsTrigger>
          <TabsTrigger value="install">Install</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="feedback" className="pt-6">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Recent feedback</CardTitle>
              <Button asChild variant="ghost" size="sm">
                <Link href={`/dashboard/feedback?projectId=${project.id}`}>View all</Link>
              </Button>
            </CardHeader>
            <CardContent className="pt-2">
              {feedback.items.length === 0 ? (
                <EmptyState
                  icon={<Inbox aria-hidden className="size-5" />}
                  title="No feedback yet"
                  description="Once the widget is installed, submissions land here."
                />
              ) : (
                <ul className="-mx-2 divide-y divide-line-subtle">
                  {feedback.items.map((item) => (
                    <li key={item.id}>
                      <FeedbackRow item={item} showProject={false} />
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="install" className="flex flex-col gap-4 pt-6">
          <Card>
            <CardHeader className="flex-row items-start justify-between gap-3">
              <div className="flex flex-col gap-1">
                <CardTitle>Install the widget</CardTitle>
                <CardDescription>
                  {connection.connected
                    ? `Connected — last request ${timeAgo(connection.lastSeen!)}.`
                    : 'Not connected yet. Paste the snippet and load the page; this flips on its own.'}
                </CardDescription>
              </div>
              <Badge tone={connection.connected ? 'success' : 'warning'} dot>
                {connection.connected ? 'Connected' : 'Waiting'}
              </Badge>
            </CardHeader>
            <CardContent className="pt-4">
              <InstallSnippet
                publicKey={publicKey}
                host={absoluteUrl('/').replace(/\/$/, '')}
                projectName={project.name}
              />
            </CardContent>
          </Card>

          <ApiKeysPanel projectId={project.id} keys={keys} />
        </TabsContent>

        <TabsContent value="settings" className="flex flex-col gap-4 pt-6">
          <ProjectSettingsForm project={project} />
          <WidgetSettingsForm project={project} categories={vocabulary.categories} />
          <ProjectDangerZone project={project} />
        </TabsContent>
      </Tabs>
    </>
  );
}
