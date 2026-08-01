import Link from 'next/link';
import type { Metadata } from 'next';
import { Inbox } from 'lucide-react';

import { requireWorkspace } from '@/lib/auth';
import { listFeedback } from '@/server/services/feedback';
import { listProjects } from '@/server/services/projects';
import { feedbackFilterSchema } from '@/lib/validation';
import { PageHeader } from '@/components/dashboard/shell';
import { FeedbackFilters } from '@/components/dashboard/feedback-filters';
import { FeedbackRow } from '@/components/dashboard/feedback-row';
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

  const [result, projects] = await Promise.all([
    listFeedback(context.workspaceId, filter),
    listProjects(context.workspaceId),
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

      <FeedbackFilters projects={projects.map((p) => ({ id: p.id, name: p.name }))} />

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
            <ul className="divide-y divide-line-subtle">
              {result.items.map((item) => (
                <li key={item.id}>
                  <FeedbackRow item={item} />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {result.totalPages > 1 ? (
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
