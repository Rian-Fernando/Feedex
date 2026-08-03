'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Field, FieldLabel, Input, NativeSelect } from '@/components/ui/field';
import { asTone } from '@/lib/taxonomy';
import {
  createLabelAction,
  deleteLabelAction,
  reorderLabelsAction,
  updateLabelAction,
} from '@/server/actions/labels';
import type { LabelKind } from '@/lib/db/schema';

/**
 * Editor for one kind of workspace label.
 *
 * Statuses and categories are the same shape and differ in two ways, both
 * handled here rather than in two near-identical components: a status also
 * carries a lifecycle, and the two are ordered independently.
 *
 * Reordering is arrow buttons rather than dragging. There are rarely more than
 * a dozen of these, they are configured once and then left alone, and arrows
 * work from a keyboard without any of the machinery the board needs.
 */

export interface ManagedLabel {
  id: string;
  key: string;
  label: string;
  tone: string;
  lifecycle: string;
  isSystem: boolean;
}

const TONES = [
  { value: 'neutral', label: 'Grey' },
  { value: 'info', label: 'Blue' },
  { value: 'accent', label: 'Violet' },
  { value: 'success', label: 'Green' },
  { value: 'warning', label: 'Amber' },
  { value: 'danger', label: 'Red' },
];

export interface LabelManagerProps {
  kind: LabelKind;
  labels: ManagedLabel[];
  canManage: boolean;
}

export function LabelManager({ kind, labels, canManage }: LabelManagerProps) {
  const router = useRouter();
  const isStatus = kind === 'status';

  const [pending, startTransition] = React.useTransition();
  const [editing, setEditing] = React.useState<ManagedLabel | null>(null);
  const [removing, setRemoving] = React.useState<ManagedLabel | null>(null);
  const [adding, setAdding] = React.useState(false);

  const runAction = (action: Promise<{ ok: boolean; error?: string }>, success: string) => {
    startTransition(async () => {
      const result = await action;
      if (!result.ok) {
        toast.error(result.error ?? 'That change could not be saved.');
        return;
      }
      toast.success(success);
      router.refresh();
    });
  };

  const swap = (index: number, direction: -1 | 1) => {
    const next = [...labels];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;

    [next[index], next[target]] = [next[target]!, next[index]!];
    runAction(
      reorderLabelsAction(
        kind,
        next.map((entry) => entry.id),
      ),
      'Order updated',
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{isStatus ? 'Statuses' : 'Categories'}</CardTitle>
        <CardDescription>
          {isStatus
            ? 'The columns on your board, and the stages feedback moves through. Each one counts as either still open or finished, which is what the dashboard totals are built from.'
            : 'What reporters can choose from in the widget, and how feedback is grouped. Each project picks which of these it offers, under the project’s own Widget settings.'}
        </CardDescription>
      </CardHeader>

      <CardContent className="pt-3">
        <ul className="divide-y divide-line-subtle">
          {labels.map((entry, index) => (
            <li key={entry.id} className="flex items-center gap-3 py-2.5">
              <div className="flex flex-col">
                <button
                  type="button"
                  aria-label={`Move ${entry.label} up`}
                  disabled={!canManage || index === 0 || pending}
                  onClick={() => swap(index, -1)}
                  className="text-fg-subtle hover:text-fg disabled:opacity-25"
                >
                  <ChevronUp aria-hidden className="size-3.5" />
                </button>
                <button
                  type="button"
                  aria-label={`Move ${entry.label} down`}
                  disabled={!canManage || index === labels.length - 1 || pending}
                  onClick={() => swap(index, 1)}
                  className="text-fg-subtle hover:text-fg disabled:opacity-25"
                >
                  <ChevronDown aria-hidden className="size-3.5" />
                </button>
              </div>

              <Badge tone={asTone(entry.tone)} dot={isStatus}>
                {entry.label}
              </Badge>

              {isStatus ? (
                <span className="text-2xs text-fg-subtle">
                  {entry.lifecycle === 'done' ? 'Counts as finished' : 'Counts as open'}
                </span>
              ) : null}

              <span className="ml-auto font-mono text-xs text-fg-subtle">{entry.key}</span>

              {canManage ? (
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" onClick={() => setEditing(entry)}>
                    Edit
                  </Button>
                  {/*
                    Built-ins stay. New feedback falls back to them when a
                    project has not configured anything, so deleting one would
                    leave ingestion with nowhere to put a report.
                  */}
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`Delete ${entry.label}`}
                    disabled={entry.isSystem || labels.length <= 1}
                    title={entry.isSystem ? 'Built-in labels cannot be deleted' : undefined}
                    onClick={() => setRemoving(entry)}
                  >
                    <Trash2 aria-hidden className="size-3.5" />
                  </Button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      </CardContent>

      {canManage ? (
        <CardFooter>
          <Button variant="secondary" size="sm" onClick={() => setAdding(true)}>
            <Plus aria-hidden className="size-3.5" />
            Add {isStatus ? 'status' : 'category'}
          </Button>
        </CardFooter>
      ) : null}

      <LabelDialog
        kind={kind}
        open={adding}
        onOpenChange={setAdding}
        onDone={() => router.refresh()}
      />

      {editing ? (
        <EditLabelDialog
          label={editing}
          isStatus={isStatus}
          onClose={() => setEditing(null)}
          onSave={(input) => {
            setEditing(null);
            runAction(updateLabelAction(editing.id, input), 'Label updated');
          }}
        />
      ) : null}

      {removing ? (
        <DeleteLabelDialog
          label={removing}
          isStatus={isStatus}
          alternatives={labels.filter((entry) => entry.id !== removing.id)}
          onClose={() => setRemoving(null)}
          onConfirm={(reassignToKey) => {
            setRemoving(null);
            runAction(deleteLabelAction(removing.id, reassignToKey), 'Label deleted');
          }}
        />
      ) : null}
    </Card>
  );
}

function LabelDialog({
  kind,
  open,
  onOpenChange,
  onDone,
}: {
  kind: LabelKind;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}) {
  const action = createLabelAction.bind(null, kind);
  const [state, formAction, pending] = React.useActionState(action, { ok: false } as {
    ok: boolean;
    error?: string;
  });

  React.useEffect(() => {
    if (state.ok) {
      toast.success('Label created');
      onOpenChange(false);
      onDone();
    }
  }, [state, onOpenChange, onDone]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form action={formAction}>
          <DialogHeader>
            <DialogTitle>Add {kind === 'status' ? 'a status' : 'a category'}</DialogTitle>
            <DialogDescription>
              {kind === 'status'
                ? 'A new column on the board.'
                : 'A new option for reporters to choose from.'}
            </DialogDescription>
          </DialogHeader>

          <DialogBody className="flex flex-col gap-4">
            <Field>
              <FieldLabel>Name</FieldLabel>
              <Input
                name="label"
                required
                maxLength={48}
                placeholder={kind === 'status' ? 'Needs design' : 'Documentation'}
              />
            </Field>

            <Field>
              <FieldLabel>Colour</FieldLabel>
              <NativeSelect name="tone" defaultValue="neutral">
                {TONES.map((tone) => (
                  <option key={tone.value} value={tone.value}>
                    {tone.label}
                  </option>
                ))}
              </NativeSelect>
            </Field>

            {kind === 'status' ? (
              <Field>
                <FieldLabel>Counts as</FieldLabel>
                <NativeSelect name="lifecycle" defaultValue="active">
                  <option value="active">Still open</option>
                  <option value="done">Finished</option>
                </NativeSelect>
                {/*
                  This is the only field here with consequences beyond display:
                  it decides which side of every "open" and "resolved" number
                  this status lands on.
                */}
                <p className="mt-1 text-xs text-fg-subtle">
                  Decides whether feedback in this status is counted as open or as resolved, and
                  whether it is stamped with a resolution time.
                </p>
              </Field>
            ) : null}
          </DialogBody>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={pending}>
              Add
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditLabelDialog({
  label,
  isStatus,
  onClose,
  onSave,
}: {
  label: ManagedLabel;
  isStatus: boolean;
  onClose: () => void;
  onSave: (input: { label: string; tone: string; lifecycle: string }) => void;
}) {
  const [name, setName] = React.useState(label.label);
  const [tone, setTone] = React.useState(label.tone);
  const [lifecycle, setLifecycle] = React.useState(label.lifecycle);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit {label.label}</DialogTitle>
          <DialogDescription>
            Renaming is safe — existing feedback keeps pointing at{' '}
            <code className="font-mono text-xs">{label.key}</code>, which never changes.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="flex flex-col gap-4">
          <Field>
            <FieldLabel>Name</FieldLabel>
            <Input value={name} onChange={(event) => setName(event.target.value)} maxLength={48} />
          </Field>

          <Field>
            <FieldLabel>Colour</FieldLabel>
            <NativeSelect value={tone} onChange={(event) => setTone(event.target.value)}>
              {TONES.map((entry) => (
                <option key={entry.value} value={entry.value}>
                  {entry.label}
                </option>
              ))}
            </NativeSelect>
          </Field>

          {isStatus ? (
            <Field>
              <FieldLabel>Counts as</FieldLabel>
              <NativeSelect
                value={lifecycle}
                onChange={(event) => setLifecycle(event.target.value)}
              >
                <option value="active">Still open</option>
                <option value="done">Finished</option>
              </NativeSelect>
            </Field>
          ) : null}
        </DialogBody>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => onSave({ label: name, tone, lifecycle })} disabled={!name.trim()}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteLabelDialog({
  label,
  isStatus,
  alternatives,
  onClose,
  onConfirm,
}: {
  label: ManagedLabel;
  isStatus: boolean;
  alternatives: ManagedLabel[];
  onClose: () => void;
  onConfirm: (reassignToKey: string) => void;
}) {
  const [target, setTarget] = React.useState(alternatives[0]?.key ?? '');

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete {label.label}</DialogTitle>
          {/*
            Deleting cannot just drop the label: feedback rows point at its key,
            and orphaned rows would vanish from every filter and off the board
            while still existing. So the choice is mandatory, not offered.
          */}
          <DialogDescription>
            Any feedback currently in {label.label} has to go somewhere. Choose where.
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          <Field>
            <FieldLabel>Move existing feedback to</FieldLabel>
            <NativeSelect value={target} onChange={(event) => setTarget(event.target.value)}>
              {alternatives.map((entry) => (
                <option key={entry.id} value={entry.key}>
                  {entry.label}
                </option>
              ))}
            </NativeSelect>
          </Field>
        </DialogBody>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="danger" onClick={() => onConfirm(target)} disabled={!target}>
            Delete {isStatus ? 'status' : 'category'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
