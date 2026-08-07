'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Mail } from 'lucide-react';
import { toast } from 'sonner';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldDescription, FieldLabel, NativeSelect } from '@/components/ui/field';
import { Switch } from '@/components/ui/misc';
import { updateNotificationsAction } from '@/server/actions/notifications';
import type { NotificationPreferences } from '@/lib/db/schema';

/**
 * Per-member email settings for this workspace.
 *
 * Off by default. An unsolicited email is a worse first impression than a
 * missed one, and someone who wants them will find this in about ten seconds.
 */
export function NotificationSettings({
  preferences,
  configured,
}: {
  preferences: NotificationPreferences;
  configured: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [draft, setDraft] = React.useState<NotificationPreferences>({
    newFeedback: preferences.newFeedback ?? false,
    minPriority: preferences.minPriority ?? 'low',
  });

  const apply = (next: NotificationPreferences) => {
    setDraft(next);
    startTransition(async () => {
      const result = await updateNotificationsAction(next);
      if (!result.ok) {
        toast.error(result.error ?? 'That could not be saved.');
        return;
      }
      toast.success('Notification settings saved');
      router.refresh();
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail aria-hidden className="size-4" />
          Notifications
        </CardTitle>
        <CardDescription>
          When to email you about this workspace. These are yours alone — other members set their
          own.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4 pt-3">
        {/*
          Said plainly rather than hidden. Someone toggling a switch that
          silently does nothing will assume the product is broken, not that
          their instance is missing an API key.
        */}
        {!configured ? (
          <p className="rounded-lg border border-warning-500/30 bg-warning-500/8 px-3 py-2 text-xs text-fg-muted">
            This instance has no email provider configured, so nothing will be sent. Set{' '}
            <code className="font-mono">RESEND_API_KEY</code> and{' '}
            <code className="font-mono">EMAIL_FROM</code> to enable delivery.
          </p>
        ) : null}

        <label className="flex items-center justify-between gap-4 rounded-lg border border-line-subtle p-3">
          <span className="flex flex-col gap-0.5">
            <span className="text-sm font-medium text-fg">Email me about new feedback</span>
            <span className="text-xs text-fg-subtle">One email per report, as it arrives.</span>
          </span>
          <Switch
            checked={draft.newFeedback ?? false}
            disabled={pending}
            onCheckedChange={(value) => apply({ ...draft, newFeedback: value })}
          />
        </label>

        {draft.newFeedback ? (
          <Field>
            <FieldLabel>Only at or above</FieldLabel>
            <NativeSelect
              value={draft.minPriority ?? 'low'}
              disabled={pending}
              onChange={(event) =>
                apply({
                  ...draft,
                  minPriority: event.target.value as NotificationPreferences['minPriority'],
                })
              }
            >
              <option value="low">Any priority</option>
              <option value="medium">Medium and above</option>
              <option value="high">High and above</option>
              <option value="critical">Critical only</option>
            </NativeSelect>
            <FieldDescription>
              A floor, not a match — asking for high still tells you about critical.
            </FieldDescription>
          </Field>
        ) : null}
      </CardContent>
    </Card>
  );
}
