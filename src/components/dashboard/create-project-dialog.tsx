'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Field,
  FieldDescription,
  FieldLabel,
  Input,
  NativeSelect,
  Textarea,
} from '@/components/ui/field';
import { CopyButton } from '@/components/ui/misc';
import { ColorPicker, COLOR_SWATCHES } from '@/components/ui/color-picker';
import { PROJECT_ENVIRONMENTS } from '@/lib/taxonomy';
import { createProjectAction } from '@/server/actions/projects';
import type { ActionResult } from '@/lib/errors';
import type { CreatedProject } from '@/server/actions/projects';

const INITIAL: ActionResult<CreatedProject> = { ok: false };

/**
 * Project creation.
 *
 * The dialog has two steps. The second exists because the secret key is only
 * ever in plaintext for the duration of the response that creates it — the
 * server keeps an HMAC and nothing else. Redirecting straight to the project
 * page would discard it, so the keys are presented here first, and navigation
 * happens on acknowledgement.
 */
export function CreateProjectDialog({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(defaultOpen);
  const [color, setColor] = React.useState<string>(COLOR_SWATCHES[0]);
  const [state, formAction, pending] = React.useActionState(createProjectAction, INITIAL);
  const created = state.ok ? state.data : undefined;

  React.useEffect(() => {
    if (created) {
      toast.success('Project created');
      router.refresh();
    }
  }, [created, router]);

  function finish() {
    setOpen(false);
    if (created) router.push(`/dashboard/projects/${created.projectId}`);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Closing the keys step navigates, so the user cannot skip past it and
        // then wonder where the secret went.
        if (!next && created) finish();
        else setOpen(next);
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus aria-hidden className="size-4" />
          New project
        </Button>
      </DialogTrigger>

      <DialogContent>
        {created ? (
          <>
            <DialogHeader>
              <DialogTitle>Save your keys</DialogTitle>
              <DialogDescription>
                The secret key is shown once. Feedex stores only a hash of it, so it cannot be
                displayed again — rotate the key if you lose it.
              </DialogDescription>
            </DialogHeader>

            <DialogBody className="flex flex-col gap-4">
              <KeyReveal
                label="Public key"
                hint="Safe to embed in client-side code."
                value={created.publicKey}
              />
              <KeyReveal
                label="Secret key"
                hint="Server-side only. Never commit this."
                value={created.secretKey}
                sensitive
              />
            </DialogBody>

            <DialogFooter>
              <Button onClick={finish}>I&apos;ve saved these — continue</Button>
            </DialogFooter>
          </>
        ) : (
          <CreateForm
            formAction={formAction}
            state={state}
            pending={pending}
            color={color}
            setColor={setColor}
            onCancel={() => setOpen(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function KeyReveal({
  label,
  hint,
  value,
  sensitive = false,
}: {
  label: string;
  hint: string;
  value: string;
  sensitive?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-fg">{label}</span>
        {sensitive ? (
          <span className="rounded-full bg-danger-500/10 px-1.5 py-0.5 text-2xs font-medium text-danger-500">
            Shown once
          </span>
        ) : null}
      </div>
      <div className="flex items-center gap-2 rounded-md border border-line-subtle bg-surface-sunken px-3 py-2">
        <code className="break-anywhere flex-1 font-mono text-xs text-fg-muted">{value}</code>
        <CopyButton value={value} label={`Copy ${label.toLowerCase()}`} />
      </div>
      <p className="text-xs text-fg-subtle">{hint}</p>
    </div>
  );
}

function CreateForm({
  formAction,
  state,
  pending,
  color,
  setColor,
  onCancel,
}: {
  formAction: (formData: FormData) => void;
  state: ActionResult<CreatedProject>;
  pending: boolean;
  color: string;
  setColor: (value: string) => void;
  onCancel: () => void;
}) {
  return (
    <>
      <DialogHeader>
        <DialogTitle>Create a project</DialogTitle>
        <DialogDescription>
          Each project gets its own widget, keys, and feedback stream.
        </DialogDescription>
      </DialogHeader>

      <form action={formAction}>
        <DialogBody className="flex flex-col gap-4">
          {state.error && state.code !== 'validation_error' ? (
            <p role="alert" className="text-sm text-danger-500">
              {state.error}
            </p>
          ) : null}

          <Field error={state.fieldErrors?.name}>
            <FieldLabel>Project name</FieldLabel>
            <Input name="name" placeholder="Portfolio" required autoFocus maxLength={120} />
          </Field>

          <Field error={state.fieldErrors?.domain}>
            <FieldLabel optional>Domain</FieldLabel>
            <Input name="domain" placeholder="rianfernando.com" maxLength={255} />
            <FieldDescription>
              Restricts widget submissions to this host and its subdomains. Leave blank to allow any
              origin.
            </FieldDescription>
          </Field>

          <Field error={state.fieldErrors?.description}>
            <FieldLabel optional>Description</FieldLabel>
            <Textarea
              name="description"
              rows={2}
              maxLength={500}
              placeholder="What this project is."
              className="min-h-16"
            />
          </Field>

          <Field error={state.fieldErrors?.environment}>
            <FieldLabel>Environment</FieldLabel>
            <NativeSelect name="environment" defaultValue="production">
              {PROJECT_ENVIRONMENTS.map((environment) => (
                <option key={environment.value} value={environment.value}>
                  {environment.label}
                </option>
              ))}
            </NativeSelect>
          </Field>

          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium text-fg">Colour</legend>
            <ColorPicker name="color" value={color} onChange={setColor} label="Project colour" />
          </fieldset>
        </DialogBody>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" loading={pending}>
            Create project
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
