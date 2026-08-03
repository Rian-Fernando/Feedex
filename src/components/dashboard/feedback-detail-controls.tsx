'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Field, FieldLabel, Textarea } from '@/components/ui/field';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FEEDBACK_PRIORITIES } from '@/lib/taxonomy';
import {
  createNoteAction,
  deleteFeedbackAction,
  updateFeedbackAction,
} from '@/server/actions/feedback';
import type { ActionResult } from '@/lib/errors';
import type { FeedbackCategory, FeedbackPriority, FeedbackStatus } from '@/lib/db/schema';

/**
 * Triage controls.
 *
 * Each select writes immediately rather than collecting into a save button:
 * triage is a rapid, one-field-at-a-time activity, and an explicit save step
 * would be friction on every single change. Optimistic state keeps the control
 * responsive while the action is in flight, and reverts if it fails.
 */
export function TriageControls({
  feedbackId,
  status,
  priority,
  category,
  statuses,
  categories,
}: {
  feedbackId: string;
  status: FeedbackStatus;
  priority: FeedbackPriority;
  category: FeedbackCategory;
  /** The workspace's own vocabulary, in display order. */
  statuses: Array<{ key: string; label: string }>;
  categories: Array<{ key: string; label: string }>;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [local, setLocal] = React.useState({ status, priority, category });

  // When the server sends fresh values after a refresh, adopt them. Adjusting
  // state during render is React's documented pattern for this and re-renders
  // before anything is painted, unlike the equivalent effect.
  const [server, setServer] = React.useState({ status, priority, category });
  if (server.status !== status || server.priority !== priority || server.category !== category) {
    setServer({ status, priority, category });
    setLocal({ status, priority, category });
  }

  function apply(patch: Partial<typeof local>) {
    const previous = local;
    setLocal((current) => ({ ...current, ...patch }));

    startTransition(async () => {
      const result = await updateFeedbackAction(feedbackId, patch);
      if (!result.ok) {
        setLocal(previous);
        toast.error(result.error ?? 'Could not save that change.');
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4" aria-busy={pending}>
      <div className="flex flex-col gap-1.5">
        <span className="text-2xs font-medium text-fg-subtle uppercase">Status</span>
        <Select
          value={local.status}
          onValueChange={(value) => apply({ status: value as FeedbackStatus })}
        >
          <SelectTrigger size="sm" aria-label="Status" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {statuses.map((item) => (
              <SelectItem key={item.key} value={item.key}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-2xs font-medium text-fg-subtle uppercase">Priority</span>
        <Select
          value={local.priority}
          onValueChange={(value) => apply({ priority: value as FeedbackPriority })}
        >
          <SelectTrigger size="sm" aria-label="Priority" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FEEDBACK_PRIORITIES.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-2xs font-medium text-fg-subtle uppercase">Category</span>
        <Select
          value={local.category}
          onValueChange={(value) => apply({ category: value as FeedbackCategory })}
        >
          <SelectTrigger size="sm" aria-label="Category" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {categories.map((item) => (
              <SelectItem key={item.key} value={item.key}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

const INITIAL: ActionResult = { ok: false };

export function NoteComposer({ feedbackId }: { feedbackId: string }) {
  const router = useRouter();
  const formRef = React.useRef<HTMLFormElement>(null);
  const action = createNoteAction.bind(null, feedbackId);
  const [state, formAction, pending] = React.useActionState(action, INITIAL);

  React.useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
      router.refresh();
    }
  }, [state, router]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-2">
      <Field error={state.fieldErrors?.body}>
        <FieldLabel className="sr-only">Internal note</FieldLabel>
        <Textarea
          name="body"
          rows={3}
          maxLength={4000}
          placeholder="Add an internal note. Only your team sees this."
          className="min-h-20"
        />
      </Field>
      <div className="flex justify-end">
        <Button type="submit" size="sm" loading={pending}>
          Add note
        </Button>
      </div>
    </form>
  );
}

export function DeleteFeedbackButton({ feedbackId }: { feedbackId: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  async function remove() {
    setPending(true);
    const result = await deleteFeedbackAction(feedbackId);
    setPending(false);

    if (!result.ok) {
      toast.error(result.error ?? 'Could not delete this item.');
      return;
    }

    toast.success('Feedback deleted');
    router.push('/dashboard/feedback');
    router.refresh();
  }

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        <Trash2 aria-hidden className="size-3.5" />
        Delete
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete this feedback?</DialogTitle>
            <DialogDescription>
              The item and its notes are removed permanently. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="pt-0" />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" loading={pending} onClick={() => void remove()}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
