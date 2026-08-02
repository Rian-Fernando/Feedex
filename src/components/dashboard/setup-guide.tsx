'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Check, Loader2, Plug, Radio } from 'lucide-react';

import { cn } from '@/lib/cn';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CopyButton } from '@/components/ui/misc';
import type { OnboardingStatus } from '@/server/services/projects';

/**
 * First-run guide.
 *
 * Three steps, shown until all three are done, then it disappears for good.
 *
 * The middle step is the one that matters. Pasting a snippet and then having no
 * idea whether it worked is the point where an integration silently stalls, so
 * this waits for the widget to actually reach the server and says so when it
 * does. That status is derived from a real ingestion request carrying the
 * project's public key — it cannot be true unless the snippet is genuinely live
 * on a page someone loaded.
 */

export interface SetupGuideProps {
  status: OnboardingStatus;
  /** Origin to embed in the snippet, so it is copy-paste correct. */
  host: string;
}

function snippetFor(host: string, publicKey: string): string {
  return `<script
  src="${host}/widget.js"
  data-feedex-key="${publicKey}"
  defer
></script>`;
}

interface StepProps {
  index: number;
  title: string;
  done: boolean;
  active: boolean;
  children?: React.ReactNode;
  aside?: React.ReactNode;
}

function Step({ index, title, done, active, children, aside }: StepProps) {
  return (
    <li className="flex gap-3.5">
      <span className="flex flex-col items-center">
        <span
          className={cn(
            'flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors',
            done
              ? 'bg-success-500/15 text-success-500'
              : active
                ? 'bg-accent-500 text-plum-900'
                : 'bg-surface-inset text-fg-subtle',
          )}
        >
          {done ? <Check aria-hidden className="size-3.5" /> : index}
        </span>
        {index < 3 ? <span aria-hidden className="mt-1 w-px flex-1 bg-line-subtle" /> : null}
      </span>

      <div className="min-w-0 flex-1 pb-6">
        <div className="flex flex-wrap items-center gap-2">
          <p className={cn('text-sm font-medium', done ? 'text-fg-muted' : 'text-fg')}>{title}</p>
          {aside}
        </div>
        {children ? <div className="mt-3">{children}</div> : null}
      </div>
    </li>
  );
}

export function SetupGuide({ status, host }: SetupGuideProps) {
  const router = useRouter();
  const { hasProject, widgetConnected, hasFeedback, project } = status;

  /*
    While the developer is on the install step, poll for the widget's first
    call home so the status flips without them reloading. Stops as soon as the
    connection is seen, and never runs once setup is complete.
  */
  const waiting = hasProject && !widgetConnected;

  React.useEffect(() => {
    if (!waiting) return;

    const timer = setInterval(() => router.refresh(), 5000);
    return () => clearInterval(timer);
  }, [waiting, router]);

  return (
    <Card className="mb-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[0.9375rem] font-semibold text-fg">Finish setting up Feedex</h2>
          <p className="mt-1 text-sm text-fg-muted">
            Three steps, and the loop is closed end to end.
          </p>
        </div>
        <span className="label-mono text-fg-subtle">
          {[hasProject, widgetConnected, hasFeedback].filter(Boolean).length} / 3
        </span>
      </div>

      <ol className="mt-6">
        <Step index={1} title="Create a project" done={hasProject} active={!hasProject}>
          {!hasProject ? (
            <Button asChild size="sm">
              <Link href="/dashboard/projects?new=1">
                Create your first project
                <ArrowRight aria-hidden className="size-3.5" />
              </Link>
            </Button>
          ) : null}
        </Step>

        <Step
          index={2}
          title="Add the widget to your site"
          done={widgetConnected}
          active={hasProject && !widgetConnected}
          aside={
            hasProject ? (
              widgetConnected ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-success-500/12 px-2 py-0.5 text-2xs font-medium text-success-500">
                  <Radio aria-hidden className="size-3" />
                  Connected
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-warning-500/12 px-2 py-0.5 text-2xs font-medium text-warning-600 dark:text-warning-400">
                  <Loader2 aria-hidden className="size-3 animate-spin" />
                  Waiting for the first request
                </span>
              )
            ) : null
          }
        >
          {hasProject && project?.publicKey && !widgetConnected ? (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-fg-muted">
                Paste this before the closing{' '}
                <code className="font-mono text-xs">&lt;/body&gt;</code> tag on {project.name}, then
                open the page. This panel updates on its own.
              </p>
              <div className="relative">
                <pre className="scrollbar-thin overflow-x-auto rounded-lg border border-line-subtle bg-surface-sunken p-4 pr-12 text-[0.8125rem] leading-relaxed">
                  <code className="font-mono text-fg-muted">
                    {snippetFor(host, project.publicKey)}
                  </code>
                </pre>
                <CopyButton
                  value={snippetFor(host, project.publicKey)}
                  label="Copy the install snippet"
                  className="absolute top-2.5 right-2.5 border border-line-subtle bg-surface-raised"
                />
              </div>
            </div>
          ) : null}
        </Step>

        <Step
          index={3}
          title="Send your first report"
          done={hasFeedback}
          active={widgetConnected && !hasFeedback}
        >
          {widgetConnected && !hasFeedback ? (
            <p className="text-sm text-fg-muted">
              The widget is live. Click the feedback button on your site and submit anything — it
              will appear here immediately.
            </p>
          ) : null}
        </Step>
      </ol>

      {status.complete ? null : (
        <p className="flex items-center gap-1.5 border-t border-line-subtle pt-4 text-xs text-fg-subtle">
          <Plug aria-hidden className="size-3" />
          Nothing to configure beyond the snippet — the widget carries its own styles and needs no
          build step.
        </p>
      )}
    </Card>
  );
}
