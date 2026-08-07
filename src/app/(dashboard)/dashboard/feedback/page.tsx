import Link from 'next/link';
import type { Metadata } from 'next';
import { Inbox } from 'lucide-react';

import { can, requireWorkspace } from '@/lib/auth';
import { listFeedback } from '@/server/services/feedback';
import { listProjects } from '@/server/services/projects';
import { getVocabulary } from '@/server/services/labels';
import { listViews } from '@/server/services/views';
import { FeedbackList } from '@/components/dashboard/feedback-list';
import { SavedViews } from '@/components/dashboard/saved-views';
import { feedbackFilterSchema } from '@/lib/validation';
import { PageHeader } from '@/components/dashboard/shell';
import { FeedbackFilters } from '@/components/dashboard/feedback-filters';
import { FeedbackBoard } from '@/components/dashboard/feedback-board';
import { ViewSwitcher, type FeedbackView } from '@/components/dashboard/view-switcher';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/misc';

export const metadata: Metadata = {
  title: 'Feedback',
};

export default async function FeedbackPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await requireWorkspace();
  const raw = await searchParams;

  // Unparseable query strings fall back to defaults rather than erroring: a
  // hand-edited URL should degrade, not break the page.
  const parsed = feedbackFilterSchema.safeParse(raw);
  const filter = parsed.success ? parsed.data : feedbackFilterSchema.parse({});

  const view: FeedbackView = raw.view === 'board' ? 'board' : 'list';

  /*
    The board shows every column at once, so paging through it makes no sense —
    it asks for one large page instead. The ceiling is deliberate: past a few
    hundred open items a board stops being readable anyway, and the columns
    say so rather than silently truncating.
  */
  const [result, projects, vocabulary, views] = await Promise.all([
    listFeedback(
      context.workspaceId,
      view === 'board' ? { ...filter, page: 1, perPage: 100 } : filter,
    ),
    listProjects(context.workspaceId),
    getVocabulary(context.workspaceId),
    listViews(context.workspaceId, context.user.id),
  ]);

  const pageParams = (page: number) => {
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries(raw)) {
      if (typeof value === 'string' && key !== 'page') next.set(key, value);
    }
    next.set('page', String(page));
    return `/dashboard/feedback?${next.toString()}`;
  };

  return (
    <>
      <PageHeader
        title="Feedback"
        description={
          result.total === 0
            ? 'Submissions from every project land here.'
            : `${result.total} ${result.total === 1 ? 'item' : 'items'}`
        }
      />

      <SavedViews views={views.map((v) => ({ id: v.id, name: v.name, query: v.query }))} />

      <div className="mb-3 flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <FeedbackFilters
            projects={projects.map((p) => ({ id: p.id, name: p.name }))}
            statuses={vocabulary.statuses}
            categories={vocabulary.categories}
          />
        </div>
        <ViewSwitcher current={view} />
      </div>

      {view === 'board' ? (
        result.items.length === 0 ? (
          <Card>
            <CardContent className="p-2">
              <EmptyState
                icon={<Inbox aria-hidden className="size-5" />}
                title="Nothing here"
                description={
                  projects.length === 0
                    ? 'Create a project and install the widget to start collecting feedback.'
                    : 'No feedback matches these filters.'
                }
              />
            </CardContent>
          </Card>
        ) : (
          <FeedbackBoard
            items={result.items}
            statuses={vocabulary.statuses}
            canUpdate={can(context.role, 'feedback.update')}
          />
        )
      ) : (
        <Card>
          <CardContent className="p-2">
            {result.items.length === 0 ? (
              <EmptyState
                icon={<Inbox aria-hidden className="size-5" />}
                title="Nothing here"
                description={
                  projects.length === 0
                    ? 'Create a project and install the widget to start collecting feedback.'
                    : 'No feedback matches these filters.'
                }
                action={
                  projects.length === 0 ? (
                    <Button asChild size="sm" variant="secondary">
                      <Link href="/dashboard/projects">Create a project</Link>
                    </Button>
                  ) : null
                }
              />
            ) : (
              <FeedbackList
                items={result.items}
                statuses={vocabulary.statuses}
                categories={vocabulary.categories}
                canUpdate={can(context.role, 'feedback.update')}
                canDelete={can(context.role, 'feedback.delete')}
              />
            )}
          </CardContent>
        </Card>
      )}

      {view === 'list' && result.totalPages > 1 ? (
        <nav aria-label="Pagination" className="mt-4 flex items-center justify-between gap-3">
          <p className="text-sm text-fg-subtle">
            Page {result.page} of {result.totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              asChild={result.page > 1}
              variant="secondary"
              size="sm"
              disabled={result.page <= 1}
            >
              {result.page > 1 ? (
                <Link href={pageParams(result.page - 1)} rel="prev">
                  Previous
                </Link>
              ) : (
                <span>Previous</span>
              )}
            </Button>
            <Button
              asChild={result.page < result.totalPages}
              variant="secondary"
              size="sm"
              disabled={result.page >= result.totalPages}
            >
              {result.page < result.totalPages ? (
                <Link href={pageParams(result.page + 1)} rel="next">
                  Next
                </Link>
              ) : (
                <span>Next</span>
              )}
            </Button>
          </div>
        </nav>
      ) : null}
    </>
  );
}
