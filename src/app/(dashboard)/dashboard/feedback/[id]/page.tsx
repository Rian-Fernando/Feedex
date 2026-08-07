import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import {
  ArrowLeft,
  Clock,
  ExternalLink,
  Globe,
  ImageOff,
  Mail,
  Monitor,
  Paperclip,
  Smartphone,
  Tablet,
} from 'lucide-react';

import { requireWorkspace } from '@/lib/auth';
import {
  findDuplicateCandidates,
  getFeedback,
  listAttachments,
  listDuplicatesOf,
  listNotes,
} from '@/server/services/feedback';
import { DuplicatesPanel } from '@/components/dashboard/duplicates-panel';
import { can } from '@/lib/auth';
import { getVocabulary } from '@/server/services/labels';
import { getProject } from '@/server/services/projects';
import { CreateIssueButton } from '@/components/dashboard/github-panel';
import { formatBytes, isInlineImage } from '@/lib/attachments';
import { PageHeader } from '@/components/dashboard/shell';
import {
  DeleteFeedbackButton,
  NoteComposer,
  TriageControls,
} from '@/components/dashboard/feedback-detail-controls';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { asTone, priorityMeta } from '@/lib/taxonomy';
import { formatDateTime, timeAgo, truncate } from '@/lib/format';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const context = await requireWorkspace();
  const item = await getFeedback(context.workspaceId, (await params).id);
  return { title: item ? truncate(item.title, 60) : 'Feedback' };
}

const DEVICE_ICONS = { desktop: Monitor, tablet: Tablet, mobile: Smartphone } as const;

export default async function FeedbackDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const context = await requireWorkspace();
  const { id } = await params;

  const item = await getFeedback(context.workspaceId, id);
  if (!item) notFound();

  const [notes, attachments, vocabulary, project, candidates, merged, canonical] =
    await Promise.all([
      listNotes(context.workspaceId, id),
      listAttachments(context.workspaceId, id),
      getVocabulary(context.workspaceId),
      getProject(context.workspaceId, item.projectId),
      // Only worth computing for a report that is not already resolved as a
      // duplicate itself.
      item.duplicateOfId ? Promise.resolve([]) : findDuplicateCandidates(context.workspaceId, id),
      listDuplicatesOf(context.workspaceId, id),
      item.duplicateOfId
        ? getFeedback(context.workspaceId, item.duplicateOfId)
        : Promise.resolve(null),
    ]);

  const priority = priorityMeta(item.priority);
  const DeviceIcon = item.context.device ? DEVICE_ICONS[item.context.device] : null;

  const contextRows: Array<{ label: string; value: string; icon?: React.ReactNode }> = [
    {
      label: 'Page',
      value: item.context.url ?? '—',
      icon: <Globe aria-hidden className="size-3.5" />,
    },
    {
      label: 'Browser',
      value: [item.context.browser, item.context.browserVersion].filter(Boolean).join(' ') || '—',
    },
    { label: 'Operating system', value: item.context.os ?? '—' },
    {
      label: 'Device',
      value: item.context.device ? item.context.device : '—',
      icon: DeviceIcon ? <DeviceIcon aria-hidden className="size-3.5" /> : undefined,
    },
    {
      label: 'Viewport',
      value: item.context.viewport
        ? `${item.context.viewport.width} × ${item.context.viewport.height}`
        : '—',
    },
    {
      label: 'Screen',
      value: item.context.screen
        ? `${item.context.screen.width} × ${item.context.screen.height}`
        : '—',
    },
    { label: 'Language', value: item.context.language ?? '—' },
    { label: 'Time zone', value: item.context.timezone ?? '—' },
    {
      label: 'Submitted',
      value: formatDateTime(item.createdAt),
      icon: <Clock aria-hidden className="size-3.5" />,
    },
  ];

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="mb-3 -ml-2">
        <Link href="/dashboard/feedback">
          <ArrowLeft aria-hidden className="size-3.5" />
          Feedback
        </Link>
      </Button>

      <PageHeader
        title={item.title}
        description={`#${item.reference} in ${item.projectName} · ${timeAgo(item.createdAt)}`}
        action={
          <div className="flex items-center gap-2">
            <CreateIssueButton
              feedbackId={item.id}
              issueUrl={item.githubIssueUrl}
              disabled={!project?.githubRepo}
            />
            <DeleteFeedbackButton feedbackId={item.id} />
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Description</CardTitle>
            </CardHeader>
            <CardContent className="pt-3">
              {/* `whitespace-pre-wrap` preserves the reporter's line breaks;
                  React escapes the content, so no sanitiser is needed here. */}
              <p className="text-sm leading-relaxed whitespace-pre-wrap text-fg-muted">
                {item.description}
              </p>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Badge tone={asTone(item.statusTone)} dot>
                  {item.statusLabel}
                </Badge>
                <Badge tone={asTone(item.categoryTone)}>{item.categoryLabel}</Badge>
                <Badge tone={priority.tone}>{priority.label} priority</Badge>
                {item.tags.map((tag) => (
                  <Badge key={tag} tone="neutral" size="sm">
                    {tag}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          <DuplicatesPanel
            feedbackId={item.id}
            candidates={candidates}
            merged={merged}
            duplicateOf={
              canonical
                ? { id: canonical.id, reference: canonical.reference, title: canonical.title }
                : null
            }
            canUpdate={can(context.role, 'feedback.update')}
          />

          <Card>
            <CardHeader>
              <CardTitle>Attachments</CardTitle>
            </CardHeader>
            <CardContent className="pt-3">
              {attachments.length > 0 || item.screenshotUrl ? (
                <ul className="flex flex-col gap-3">
                  {attachments.map((file) => (
                    <li key={file.id}>
                      {isInlineImage(file.mimeType) ? (
                        <a
                          href={`/api/attachments/${file.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group block"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element -- served from our own attachment route, not an optimisable static asset */}
                          <img
                            src={`/api/attachments/${file.id}`}
                            alt={file.name}
                            className="w-full rounded-lg border border-line-subtle transition-colors group-hover:border-accent-500"
                          />
                          <span className="mt-1.5 flex items-center justify-between gap-2 text-xs text-fg-subtle">
                            <span className="truncate">{file.name}</span>
                            <span className="shrink-0">{formatBytes(file.size)}</span>
                          </span>
                        </a>
                      ) : (
                        <a
                          href={`/api/attachments/${file.id}`}
                          download={file.name}
                          className="flex items-center gap-3 rounded-lg border border-line-subtle p-3 transition-colors hover:border-accent-500"
                        >
                          <Paperclip aria-hidden className="size-4 shrink-0 text-fg-subtle" />
                          <span className="min-w-0 flex-1 truncate text-sm text-fg">
                            {file.name}
                          </span>
                          <span className="shrink-0 text-xs text-fg-subtle">
                            {formatBytes(file.size)}
                          </span>
                        </a>
                      )}
                    </li>
                  ))}

                  {item.screenshotUrl ? (
                    <li>
                      {/* eslint-disable-next-line @next/next/no-img-element -- user-supplied external URL */}
                      <img
                        src={item.screenshotUrl}
                        alt={`Screenshot submitted with feedback #${item.reference}`}
                        className="w-full rounded-lg border border-line-subtle"
                      />
                    </li>
                  ) : null}
                </ul>
              ) : (
                <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-line-subtle px-6 py-10 text-center text-fg-subtle">
                  <ImageOff aria-hidden className="size-5" />
                  <p className="text-sm">Nothing was attached to this report.</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Internal notes</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 pt-3">
              {notes.length > 0 ? (
                <ul className="flex flex-col gap-3">
                  {notes.map((note) => (
                    <li
                      key={note.id}
                      className="rounded-lg border border-line-subtle bg-surface-inset/50 p-3"
                    >
                      <p className="text-sm leading-relaxed whitespace-pre-wrap text-fg-muted">
                        {note.body}
                      </p>
                      <p className="mt-2 text-xs text-fg-subtle">
                        {note.authorName ?? 'Unknown'} · {timeAgo(note.createdAt)}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-fg-subtle">No notes yet.</p>
              )}

              <NoteComposer feedbackId={item.id} />
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Triage</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <TriageControls
                feedbackId={item.id}
                status={item.status}
                priority={item.priority}
                category={item.category}
                statuses={vocabulary.statuses}
                categories={vocabulary.categories}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Reporter</CardTitle>
            </CardHeader>
            <CardContent className="pt-3">
              {item.reporterEmail ? (
                <div className="flex flex-col gap-1">
                  {item.reporterName ? (
                    <p className="text-sm font-medium text-fg">{item.reporterName}</p>
                  ) : null}
                  <a
                    href={`mailto:${item.reporterEmail}`}
                    className="flex items-center gap-1.5 text-sm text-accent-500 hover:underline"
                  >
                    <Mail aria-hidden className="size-3.5 shrink-0" />
                    <span className="break-anywhere">{item.reporterEmail}</span>
                  </a>
                </div>
              ) : (
                <p className="text-sm text-fg-subtle">Submitted anonymously.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Context</CardTitle>
            </CardHeader>
            <CardContent className="pt-3">
              <dl className="flex flex-col gap-2.5">
                {contextRows.map((row) => (
                  <div key={row.label} className="flex items-start justify-between gap-3">
                    <dt className="shrink-0 text-xs text-fg-subtle">{row.label}</dt>
                    <dd className="min-w-0 text-right text-xs text-fg-muted">
                      {row.label === 'Page' && item.context.url ? (
                        <a
                          href={item.context.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 break-all hover:text-accent-500"
                        >
                          {truncate(item.context.url.replace(/^https?:\/\//, ''), 32)}
                          <ExternalLink aria-hidden className="size-3 shrink-0" />
                        </a>
                      ) : (
                        <span className="break-anywhere capitalize">{row.value}</span>
                      )}
                    </dd>
                  </div>
                ))}
              </dl>

              {item.context.custom && Object.keys(item.context.custom).length > 0 ? (
                <>
                  <p className="mt-4 border-t border-line-subtle pt-3 text-2xs font-medium text-fg-subtle uppercase">
                    Custom metadata
                  </p>
                  <dl className="mt-2 flex flex-col gap-2">
                    {Object.entries(item.context.custom).map(([key, value]) => (
                      <div key={key} className="flex items-start justify-between gap-3">
                        <dt className="shrink-0 font-mono text-xs text-fg-subtle">{key}</dt>
                        <dd className="break-anywhere min-w-0 text-right text-xs text-fg-muted">
                          {value}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Project</CardTitle>
            </CardHeader>
            <CardContent className="pt-3">
              <Link
                href={`/dashboard/projects/${item.projectId}`}
                className="-m-2 flex items-center gap-2.5 rounded-lg p-2 transition-colors hover:bg-surface-inset"
              >
                <span
                  aria-hidden
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: item.projectColor }}
                />
                <span className="flex-1 truncate text-sm font-medium text-fg">
                  {item.projectName}
                </span>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
