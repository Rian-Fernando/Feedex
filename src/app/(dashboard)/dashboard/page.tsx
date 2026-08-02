import Link from 'next/link';
import type { Metadata } from 'next';
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  FolderKanban,
  Inbox,
  MessageSquare,
  Plus,
} from 'lucide-react';

import { requireWorkspace } from '@/lib/auth';
import { getWorkspaceStats, recentFeedback } from '@/server/services/feedback';
import { listActivity } from '@/server/services/activity';
import { getOnboarding, listProjects } from '@/server/services/projects';
import { PageHeader } from '@/components/dashboard/shell';
import { SetupGuide } from '@/components/dashboard/setup-guide';
import { DistributionBar, StatCard, TrendSparkline } from '@/components/dashboard/stat-card';
import { ActivityTimeline } from '@/components/dashboard/activity-timeline';
import { FeedbackRow } from '@/components/dashboard/feedback-row';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/misc';
import { FEEDBACK_CATEGORIES } from '@/lib/taxonomy';
import { formatCount, percentChange } from '@/lib/format';
import { absoluteUrl } from '@/config/site';

export const metadata: Metadata = {
  title: 'Overview',
};

const CATEGORY_BAR_CLASSES: Record<string, string> = {
  bug: 'bg-danger-500',
  feature: 'bg-accent-500',
  ui: 'bg-info-500',
  performance: 'bg-warning-500',
  content: 'bg-plum-400',
  question: 'bg-info-400',
  other: 'bg-plum-500',
};

export default async function OverviewPage() {
  const context = await requireWorkspace();

  const [stats, recent, activity, projects, onboarding] = await Promise.all([
    getWorkspaceStats(context.workspaceId),
    recentFeedback(context.workspaceId, 5),
    listActivity(context.workspaceId, 8),
    listProjects(context.workspaceId),
    getOnboarding(context.workspaceId),
  ]);

  const delta = percentChange(stats.last7Days, stats.previous7Days);
  const resolutionRate =
    stats.totalFeedback > 0 ? Math.round((stats.resolvedFeedback / stats.totalFeedback) * 100) : 0;

  return (
    <>
      <PageHeader
        title={`Welcome back, ${context.user.name.split(' ')[0]}`}
        description="Everything happening across your projects."
        action={
          <Button asChild size="sm">
            <Link href="/dashboard/projects?new=1">
              <Plus aria-hidden className="size-4" />
              New project
            </Link>
          </Button>
        }
      />

      {/* Guided first run, until the loop has been closed once. */}
      {onboarding.complete ? null : (
        <SetupGuide status={onboarding} host={absoluteUrl('/').replace(/\/$/, '')} />
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Projects"
          value={stats.projects}
          icon={<FolderKanban aria-hidden className="size-4" />}
          hint={stats.projects === 0 ? 'Create your first project' : 'Collecting feedback'}
        />
        <StatCard
          label="Open issues"
          value={formatCount(stats.openFeedback)}
          icon={<Inbox aria-hidden className="size-4" />}
          hint="Open, in progress, or testing"
        />
        <StatCard
          label="Resolved"
          value={formatCount(stats.resolvedFeedback)}
          icon={<CheckCircle2 aria-hidden className="size-4" />}
          hint={`${resolutionRate}% resolution rate`}
        />
        <StatCard
          label="Total reports"
          value={formatCount(stats.totalFeedback)}
          delta={delta}
          icon={<MessageSquare aria-hidden className="size-4" />}
          hint="Last 7 days vs. previous"
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Feedback volume</CardTitle>
            <span className="text-xs text-fg-subtle">Last 14 days</span>
          </CardHeader>
          <CardContent className="pt-4">
            <TrendSparkline data={stats.trend} />
            <div className="mt-3 flex items-center justify-between text-xs text-fg-subtle">
              <span>{stats.trend[0]?.date}</span>
              <span className="font-medium text-fg-muted tabular-nums">
                {stats.last7Days} this week
              </span>
              <span>Today</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>By category</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 pt-4">
            <DistributionBar
              segments={FEEDBACK_CATEGORIES.map((category) => ({
                label: category.label,
                value: stats.byCategory[category.value],
                className: CATEGORY_BAR_CLASSES[category.value] ?? 'bg-plum-500',
              }))}
            />
            <ul className="flex flex-col gap-1.5">
              {FEEDBACK_CATEGORIES.filter((category) => stats.byCategory[category.value] > 0)
                .sort((a, b) => stats.byCategory[b.value] - stats.byCategory[a.value])
                .slice(0, 5)
                .map((category) => (
                  <li key={category.value} className="flex items-center gap-2 text-sm">
                    <span
                      aria-hidden
                      className={`size-2 shrink-0 rounded-full ${CATEGORY_BAR_CLASSES[category.value]}`}
                    />
                    <span className="flex-1 truncate text-fg-muted">{category.label}</span>
                    <span className="font-medium text-fg tabular-nums">
                      {stats.byCategory[category.value]}
                    </span>
                  </li>
                ))}
              {stats.totalFeedback === 0 ? (
                <li className="text-sm text-fg-subtle">No feedback yet.</li>
              ) : null}
            </ul>
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Recent feedback</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link href="/dashboard/feedback">
                View all
                <ArrowRight aria-hidden className="size-3.5" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="pt-2">
            {recent.length === 0 ? (
              <EmptyState
                icon={<Inbox aria-hidden className="size-5" />}
                title="No feedback yet"
                description={
                  projects.length === 0
                    ? 'Create a project and install the widget to start collecting feedback.'
                    : 'Install the widget on your site and feedback will appear here.'
                }
                action={
                  <Button asChild size="sm" variant="secondary">
                    <Link href="/dashboard/projects">
                      {projects.length === 0 ? 'Create a project' : 'Get the snippet'}
                    </Link>
                  </Button>
                }
              />
            ) : (
              <ul className="-mx-2 divide-y divide-line-subtle">
                {recent.map((item) => (
                  <li key={item.id}>
                    <FeedbackRow item={item} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Activity</CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {activity.length === 0 ? (
              <EmptyState
                icon={<Activity aria-hidden className="size-5" />}
                title="Nothing yet"
                description="Changes to projects and feedback show up here."
                className="py-8"
              />
            ) : (
              <ActivityTimeline entries={activity} />
            )}
          </CardContent>
        </Card>
      </div>

      {projects.length > 0 ? (
        <Card className="mt-4">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Projects</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link href="/dashboard/projects">
                Manage
                <ArrowRight aria-hidden className="size-3.5" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="grid gap-3 pt-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.slice(0, 6).map((project) => (
              <Link
                key={project.id}
                href={`/dashboard/projects/${project.id}`}
                className="flex items-center gap-3 rounded-lg border border-line-subtle p-3 transition-colors hover:border-line-strong hover:bg-surface-inset/50"
              >
                <span
                  aria-hidden
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: project.color }}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-fg">{project.name}</span>
                  <span className="block truncate text-xs text-fg-subtle">
                    {project.openFeedback} open · {project.totalFeedback} total
                  </span>
                </span>
              </Link>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </>
  );
}
