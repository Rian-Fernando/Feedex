'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ExternalLink, Globe } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/field';
import { CopyButton, Switch } from '@/components/ui/misc';
import { setFeedbackPublicAction, setRoadmapEnabledAction } from '@/server/actions/roadmap';

/** Per-project roadmap switch, plus the public address once it is on. */
export function RoadmapPanel({
  projectId,
  enabled,
  publicUrl,
  canEdit,
}: {
  projectId: string;
  enabled: boolean;
  publicUrl: string | null;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe aria-hidden className="size-4" />
          Public roadmap
        </CardTitle>
        <CardDescription>
          A page anyone can read, showing what is planned, in progress, and shipped. Reports appear
          only when you publish them individually — nothing here is mirrored automatically.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4 pt-3">
        <label className="flex items-center justify-between gap-4 rounded-lg border border-line-subtle p-3">
          <span className="flex flex-col gap-0.5">
            <span className="text-sm font-medium text-fg">Publish a roadmap</span>
            <span className="text-xs text-fg-subtle">
              Turning this off hides the page but keeps its address, so a link you shared still
              works if you turn it back on.
            </span>
          </span>
          <Switch
            checked={enabled}
            disabled={!canEdit || pending}
            onCheckedChange={(value) =>
              startTransition(async () => {
                const result = await setRoadmapEnabledAction(projectId, value);
                if (!result.ok) {
                  toast.error(result.error ?? 'That could not be saved.');
                  return;
                }
                toast.success(value ? 'Roadmap published' : 'Roadmap hidden');
                router.refresh();
              })
            }
          />
        </label>

        {enabled && publicUrl ? (
          <div className="flex items-center gap-2">
            <Input readOnly value={publicUrl} className="font-mono text-xs" />
            <CopyButton value={publicUrl} label="Copy the roadmap address" />
            <Button asChild variant="secondary" size="sm">
              <a href={publicUrl} target="_blank" rel="noopener noreferrer">
                Open
                <ExternalLink aria-hidden className="size-3" />
              </a>
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

/**
 * Publishes one report.
 *
 * Offers a separate public title because the stored one is derived from the
 * reporter's first sentence, which is frequently not a sentence you would put
 * on a public page.
 */
export function PublishToggle({
  feedbackId,
  isPublic,
  publicTitle,
  title,
  roadmapEnabled,
  canUpdate,
}: {
  feedbackId: string;
  isPublic: boolean;
  publicTitle: string | null;
  title: string;
  roadmapEnabled: boolean;
  canUpdate: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [draft, setDraft] = React.useState(publicTitle ?? '');

  if (!roadmapEnabled || !canUpdate) return null;

  const apply = (nextPublic: boolean, nextTitle?: string) =>
    startTransition(async () => {
      const result = await setFeedbackPublicAction(feedbackId, nextPublic, nextTitle);
      if (!result.ok) {
        toast.error(result.error ?? 'That could not be saved.');
        return;
      }
      toast.success(nextPublic ? 'Published to the roadmap' : 'Removed from the roadmap');
      router.refresh();
    });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Public roadmap</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 pt-2">
        <label className="flex items-center justify-between gap-3">
          <span className="text-sm text-fg-muted">Show on the roadmap</span>
          <Switch
            checked={isPublic}
            disabled={pending}
            onCheckedChange={(value) => apply(value, draft)}
          />
        </label>

        {isPublic ? (
          <div className="flex flex-col gap-1.5">
            <label className="text-2xs font-medium text-fg-subtle uppercase" htmlFor="public-title">
              Public title
            </label>
            <Input
              id="public-title"
              value={draft}
              placeholder={title}
              maxLength={200}
              disabled={pending}
              onChange={(event) => setDraft(event.target.value)}
              onBlur={() => draft !== (publicTitle ?? '') && apply(true, draft)}
            />
            <p className="text-xs text-fg-subtle">
              Optional. Leave blank to use the report&apos;s own title.
            </p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
