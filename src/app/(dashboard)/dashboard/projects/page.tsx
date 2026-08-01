import Link from 'next/link';
import type { Metadata } from 'next';
import { FolderKanban, Globe } from 'lucide-react';

import { requireWorkspace } from '@/lib/auth';
import { listProjects } from '@/server/services/projects';
import { PageHeader } from '@/components/dashboard/shell';
import { CreateProjectDialog } from '@/components/dashboard/create-project-dialog';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/misc';
import { environmentMeta, projectStatusMeta } from '@/lib/taxonomy';
import { formatDate } from '@/lib/format';

export const metadata: Metadata = {
  title: 'Projects',
};

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ new?: string }>;
}) {
  const context = await requireWorkspace();
  const [projects, params] = await Promise.all([listProjects(context.workspaceId), searchParams]);

  return (
    <>
      <PageHeader
        title="Projects"
        description="Every site or app collecting feedback into this workspace."
        action={<CreateProjectDialog defaultOpen={params.new === '1'} />}
      />

      {projects.length === 0 ? (
        <Card>
          <EmptyState
            icon={<FolderKanban aria-hidden className="size-5" />}
            title="No projects yet"
            description="Create a project to get a widget snippet and start collecting feedback."
            action={<CreateProjectDialog />}
          />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {projects.map((project) => {
            const environment = environmentMeta(project.environment);
            const status = projectStatusMeta(project.status);

            return (
              <Card key={project.id} interactive className="overflow-hidden">
                <Link href={`/dashboard/projects/${project.id}`} className="block p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span
                        aria-hidden
                        className="size-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: project.color }}
                      />
                      <h2 className="truncate text-[0.9375rem] font-semibold text-fg">
                        {project.name}
                      </h2>
                    </div>
                    <Badge tone={status.tone} size="sm">
                      {status.label}
                    </Badge>
                  </div>

                  {project.description ? (
                    <p className="mt-2 line-clamp-2 text-sm text-fg-muted">{project.description}</p>
                  ) : null}

                  {project.domain ? (
                    <p className="mt-2 flex items-center gap-1.5 text-xs text-fg-subtle">
                      <Globe aria-hidden className="size-3 shrink-0" />
                      <span className="truncate">{project.domain}</span>
                    </p>
                  ) : null}

                  <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-line-subtle pt-4">
                    <div>
                      <dt className="text-2xs text-fg-subtle">Open</dt>
                      <dd className="mt-0.5 text-lg font-semibold text-fg tabular-nums">
                        {project.openFeedback}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-2xs text-fg-subtle">Total</dt>
                      <dd className="mt-0.5 text-lg font-semibold text-fg tabular-nums">
                        {project.totalFeedback}
                      </dd>
                    </div>
                  </dl>

                  <p className="mt-3 flex items-center gap-2 text-xs text-fg-subtle">
                    <Badge tone={environment.tone} size="sm">
                      {environment.label}
                    </Badge>
                    <span>Created {formatDate(project.createdAt)}</span>
                  </p>
                </Link>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
