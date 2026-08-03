'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Field, FieldDescription, FieldLabel, Input } from '@/components/ui/field';
import { GithubIcon } from '@/components/brand/github-icon';
import { setProjectRepoAction } from '@/server/actions/github';

/**
 * Per-project GitHub repository.
 *
 * Saving verifies the repository is reachable and accepts issues before
 * storing it, so a typo surfaces here rather than the first time somebody
 * tries to file during triage.
 */
export function GithubPanel({
  projectId,
  repo,
  connected,
  canEdit,
}: {
  projectId: string;
  repo: string | null;
  connected: boolean;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [value, setValue] = React.useState(repo ?? '');
  const [pending, startTransition] = React.useTransition();

  const save = () => {
    startTransition(async () => {
      const result = await setProjectRepoAction(projectId, value);

      if (!result.ok) {
        toast.error(result.error ?? 'That repository could not be saved.');
        return;
      }

      toast.success(value.trim() ? 'Repository connected' : 'Repository removed');
      router.refresh();
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GithubIcon className="size-4" />
          GitHub
        </CardTitle>
        <CardDescription>
          File feedback from this project straight into a repository, with the browser, viewport,
          and page already attached.
        </CardDescription>
      </CardHeader>

      <CardContent className="pt-3">
        {connected ? (
          <Field>
            <FieldLabel optional>Repository</FieldLabel>
            <Input
              value={value}
              onChange={(event) => setValue(event.target.value)}
              placeholder="owner/name"
              disabled={!canEdit || pending}
              className="font-mono"
            />
            <FieldDescription>Checked when you save. Leave blank to disconnect.</FieldDescription>
          </Field>
        ) : (
          <div className="rounded-lg border border-dashed border-line-subtle p-4">
            <p className="text-sm text-fg-muted">
              Connect your GitHub account to file issues. Feedex asks for repository access at that
              point, not at sign-in — most people never need it.
            </p>
            <Button asChild variant="secondary" size="sm" className="mt-3">
              {/*
                A full page navigation, not a fetch: this leaves for GitHub's
                consent screen and comes back to this exact page.
              */}
              <a href={`/api/auth/github?intent=connect&next=/dashboard/projects/${projectId}`}>
                <GithubIcon className="size-3.5" />
                Connect GitHub
              </a>
            </Button>
          </div>
        )}
      </CardContent>

      {connected && canEdit ? (
        <CardFooter className="justify-end">
          <Button size="sm" onClick={save} loading={pending}>
            Save repository
          </Button>
        </CardFooter>
      ) : null}
    </Card>
  );
}

/** Files one report as an issue, or links to the issue already filed. */
export function CreateIssueButton({
  feedbackId,
  issueUrl,
  disabled,
}: {
  feedbackId: string;
  issueUrl: string | null;
  disabled: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  if (issueUrl) {
    return (
      <Button asChild variant="secondary" size="sm">
        <a href={issueUrl} target="_blank" rel="noopener noreferrer">
          <GithubIcon className="size-3.5" />
          View issue
          <ExternalLink aria-hidden className="size-3" />
        </a>
      </Button>
    );
  }

  return (
    <Button
      variant="secondary"
      size="sm"
      loading={pending}
      disabled={disabled}
      title={disabled ? 'Set a GitHub repository on this project first' : undefined}
      onClick={() =>
        startTransition(async () => {
          const { createGithubIssueAction } = await import('@/server/actions/github');
          const result = await createGithubIssueAction(feedbackId);

          if (!result.ok) {
            toast.error(result.error ?? 'The issue could not be created.');
            return;
          }

          toast.success('Issue created on GitHub');
          router.refresh();
        })
      }
    >
      <GithubIcon className="size-3.5" />
      Create issue
    </Button>
  );
}
