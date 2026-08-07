'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Copy, GitMerge } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { mergeFeedbackAction, unmergeFeedbackAction } from '@/server/actions/duplicates';

/**
 * Possible duplicates, and anything already merged in.
 *
 * Nothing is merged automatically. The matching is mechanical — word overlap
 * and a shared page — and mechanical matching is wrong often enough that acting
 * on it unprompted would quietly lose reports. So the panel shows its reasoning
 * and a person decides.
 */

export interface DuplicateCandidateView {
  id: string;
  reference: number;
  title: string;
  score: number;
  reasons: string[];
}

export interface MergedView {
  id: string;
  reference: number;
  title: string;
  reporterEmail: string | null;
}

export function DuplicatesPanel({
  feedbackId,
  candidates,
  merged,
  duplicateOf,
  canUpdate,
}: {
  feedbackId: string;
  candidates: DuplicateCandidateView[];
  merged: MergedView[];
  duplicateOf: { id: string; reference: number; title: string } | null;
  canUpdate: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  const run = (action: Promise<{ ok: boolean; error?: string }>, success: string) => {
    startTransition(async () => {
      const result = await action;
      if (!result.ok) {
        toast.error(result.error ?? 'That could not be applied.');
        return;
      }
      toast.success(success);
      router.refresh();
    });
  };

  // This report is itself a duplicate: the only thing worth showing is where it
  // went, and a way back out.
  if (duplicateOf) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitMerge aria-hidden className="size-4" />
            Merged
          </CardTitle>
          <CardDescription>
            This report was folded into another as a duplicate. It is hidden from the queue but
            still counted.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3 pt-3">
          <Link
            href={`/dashboard/feedback/${duplicateOf.id}`}
            className="text-sm text-accent-500 hover:underline"
          >
            #{duplicateOf.reference} · {duplicateOf.title}
          </Link>
          {canUpdate ? (
            <Button
              variant="ghost"
              size="sm"
              loading={pending}
              className="ml-auto"
              onClick={() => run(unmergeFeedbackAction(feedbackId), 'Unmerged')}
            >
              Unmerge
            </Button>
          ) : null}
        </CardContent>
      </Card>
    );
  }

  if (candidates.length === 0 && merged.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Copy aria-hidden className="size-4" />
          {merged.length > 0 ? `Duplicates (${merged.length})` : 'Possible duplicates'}
        </CardTitle>
        <CardDescription>
          {merged.length > 0
            ? 'Reports folded into this one. Their reporters are who to tell when it ships.'
            : 'Matched on wording and the page they came from. Nothing is merged until you say so.'}
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-2 pt-3">
        {merged.map((item) => (
          <div
            key={item.id}
            className="flex flex-wrap items-center gap-2 rounded-lg border border-line-subtle p-2.5"
          >
            <Link
              href={`/dashboard/feedback/${item.id}`}
              className="min-w-0 flex-1 truncate text-sm text-fg transition-colors hover:text-accent-500"
            >
              <span className="text-fg-subtle">#{item.reference}</span> {item.title}
            </Link>
            {item.reporterEmail ? (
              <span className="truncate text-xs text-fg-subtle">{item.reporterEmail}</span>
            ) : null}
            {canUpdate ? (
              <Button
                variant="ghost"
                size="sm"
                loading={pending}
                onClick={() => run(unmergeFeedbackAction(item.id), 'Unmerged')}
              >
                Unmerge
              </Button>
            ) : null}
          </div>
        ))}

        {candidates.map((item) => (
          <div
            key={item.id}
            className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-line-subtle p-2.5"
          >
            <div className="min-w-0 flex-1">
              <Link
                href={`/dashboard/feedback/${item.id}`}
                className="block truncate text-sm text-fg transition-colors hover:text-accent-500"
              >
                <span className="text-fg-subtle">#{item.reference}</span> {item.title}
              </Link>
              {/* The reasoning is shown, not hidden behind a score. It is what
                  makes the suggestion checkable in a second. */}
              <p className="mt-0.5 text-xs text-fg-subtle">{item.reasons.join(' · ')}</p>
            </div>
            {canUpdate ? (
              <Button
                variant="secondary"
                size="sm"
                loading={pending}
                onClick={() =>
                  run(mergeFeedbackAction(feedbackId, item.id), `Merged into #${item.reference}`)
                }
              >
                <GitMerge aria-hidden className="size-3.5" />
                Merge into this
              </Button>
            ) : null}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
