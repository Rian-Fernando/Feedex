'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
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
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Field,
  FieldDescription,
  FieldLabel,
  Input,
  NativeSelect,
  Textarea,
} from '@/components/ui/field';
import { Switch } from '@/components/ui/misc';
import { FEEDBACK_CATEGORIES, PROJECT_ENVIRONMENTS, PROJECT_STATUSES } from '@/lib/taxonomy';
import {
  deleteProjectAction,
  updateProjectAction,
  updateWidgetSettingsAction,
} from '@/server/actions/projects';
import type { ActionResult } from '@/lib/errors';
import type { Project } from '@/lib/db/schema';

const INITIAL: ActionResult = { ok: false };

/** General project settings. */
export function ProjectSettingsForm({ project }: { project: Project }) {
  const router = useRouter();
  const action = updateProjectAction.bind(null, project.id);
  const [state, formAction, pending] = React.useActionState(action, INITIAL);

  React.useEffect(() => {
    if (state.ok) {
      toast.success('Project updated');
      router.refresh();
    }
  }, [state, router]);

  return (
    <Card>
      <form action={formAction}>
        <CardHeader>
          <CardTitle>Project settings</CardTitle>
          <CardDescription>Name, domain, and environment.</CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col gap-4 pt-4">
          <Field error={state.fieldErrors?.name}>
            <FieldLabel>Name</FieldLabel>
            <Input name="name" defaultValue={project.name} required maxLength={120} />
          </Field>

          <Field error={state.fieldErrors?.domain}>
            <FieldLabel optional>Domain</FieldLabel>
            <Input name="domain" defaultValue={project.domain ?? ''} maxLength={255} />
            <FieldDescription>
              Widget submissions are accepted from this host and its subdomains. localhost is always
              allowed so you can test locally.
            </FieldDescription>
          </Field>

          <Field error={state.fieldErrors?.description}>
            <FieldLabel optional>Description</FieldLabel>
            <Textarea
              name="description"
              defaultValue={project.description ?? ''}
              rows={2}
              maxLength={500}
              className="min-h-16"
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field error={state.fieldErrors?.environment}>
              <FieldLabel>Environment</FieldLabel>
              <NativeSelect name="environment" defaultValue={project.environment}>
                {PROJECT_ENVIRONMENTS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </NativeSelect>
            </Field>

            <Field error={state.fieldErrors?.status}>
              <FieldLabel>Status</FieldLabel>
              <NativeSelect name="status" defaultValue={project.status}>
                {PROJECT_STATUSES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </NativeSelect>
            </Field>

            <Field error={state.fieldErrors?.color}>
              <FieldLabel>Colour</FieldLabel>
              <Input
                name="color"
                type="color"
                defaultValue={project.color}
                className="h-9.5 cursor-pointer p-1"
              />
            </Field>
          </div>
        </CardContent>

        <CardFooter className="justify-end">
          <Button type="submit" loading={pending} size="sm">
            Save changes
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

/** Widget appearance and behaviour. */
export function WidgetSettingsForm({ project }: { project: Project }) {
  const router = useRouter();
  const action = updateWidgetSettingsAction.bind(null, project.id);
  const [state, formAction, pending] = React.useActionState(action, INITIAL);

  const settings = project.widgetSettings;
  const enabled = settings.categories ?? ['bug', 'feature', 'ui', 'other'];

  React.useEffect(() => {
    if (state.ok) {
      toast.success('Widget updated');
      router.refresh();
    }
  }, [state, router]);

  return (
    <Card>
      <form action={formAction}>
        <CardHeader>
          <CardTitle>Widget</CardTitle>
          <CardDescription>How the feedback widget looks and behaves on your site.</CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col gap-4 pt-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel>Button label</FieldLabel>
              <Input
                name="buttonLabel"
                defaultValue={settings.buttonLabel ?? 'Feedback'}
                maxLength={32}
              />
            </Field>

            <Field>
              <FieldLabel>Accent colour</FieldLabel>
              <Input
                name="accentColor"
                type="color"
                defaultValue={settings.accentColor ?? project.color}
                className="h-9.5 cursor-pointer p-1"
              />
            </Field>

            <Field>
              <FieldLabel>Position</FieldLabel>
              <NativeSelect name="position" defaultValue={settings.position ?? 'bottom-right'}>
                <option value="bottom-right">Bottom right</option>
                <option value="bottom-left">Bottom left</option>
              </NativeSelect>
            </Field>

            <Field>
              <FieldLabel>Theme</FieldLabel>
              <NativeSelect name="theme" defaultValue={settings.theme ?? 'auto'}>
                <option value="auto">Match the visitor&apos;s system</option>
                <option value="light">Always light</option>
                <option value="dark">Always dark</option>
              </NativeSelect>
            </Field>
          </div>

          <Field>
            <FieldLabel>Panel title</FieldLabel>
            <Input name="title" defaultValue={settings.title ?? 'Send feedback'} maxLength={64} />
          </Field>

          <Field>
            <FieldLabel>Panel description</FieldLabel>
            <Input
              name="description"
              defaultValue={settings.description ?? 'Found a bug or have an idea? Let us know.'}
              maxLength={160}
            />
          </Field>

          <Field>
            <FieldLabel>Success message</FieldLabel>
            <Input
              name="successMessage"
              defaultValue={settings.successMessage ?? 'Thanks — your feedback has been received.'}
              maxLength={160}
            />
          </Field>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium text-fg">Categories</legend>
            <p className="mb-1 text-xs text-fg-subtle">
              Which options the reporter can choose from.
            </p>
            <div className="flex flex-wrap gap-2">
              {FEEDBACK_CATEGORIES.map((category) => (
                <label
                  key={category.value}
                  className="flex cursor-pointer items-center gap-2 rounded-full border border-line px-3 py-1.5 text-xs font-medium text-fg-muted transition-colors hover:border-line-strong has-checked:border-accent-500 has-checked:bg-accent-500/10 has-checked:text-accent-500"
                >
                  <input
                    type="checkbox"
                    name="categories"
                    value={category.value}
                    defaultChecked={enabled.includes(category.value)}
                    className="sr-only"
                  />
                  {category.label}
                </label>
              ))}
            </div>
          </fieldset>

          <label className="flex items-center justify-between gap-4 rounded-lg border border-line-subtle p-3">
            <span className="flex flex-col gap-0.5">
              <span className="text-sm font-medium text-fg">Require an email address</span>
              <span className="text-xs text-fg-subtle">
                Reporters must provide an email before they can submit.
              </span>
            </span>
            <Switch name="requireEmail" defaultChecked={settings.requireEmail ?? false} />
          </label>
        </CardContent>

        <CardFooter className="justify-end">
          <Button type="submit" loading={pending} size="sm">
            Save widget
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

/** Irreversible project actions. */
export function ProjectDangerZone({ project }: { project: Project }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [confirmation, setConfirmation] = React.useState('');
  const [pending, setPending] = React.useState(false);

  async function remove() {
    setPending(true);
    const result = await deleteProjectAction(project.id);
    setPending(false);

    if (!result.ok) {
      toast.error(result.error ?? 'Could not delete the project.');
      return;
    }

    toast.success('Project deleted');
    setOpen(false);
    router.push('/dashboard/projects');
    router.refresh();
  }

  return (
    <>
      <Card className="border-danger-500/25">
        <CardHeader>
          <CardTitle className="text-danger-500">Danger zone</CardTitle>
          <CardDescription>
            Deleting this project permanently removes its feedback, notes, and keys.
          </CardDescription>
        </CardHeader>
        <CardFooter className="justify-end">
          <Button variant="danger" size="sm" onClick={() => setOpen(true)}>
            <Trash2 aria-hidden className="size-3.5" />
            Delete project
          </Button>
        </CardFooter>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete {project.name}?</DialogTitle>
            <DialogDescription>
              This removes the project and everything in it. This cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <DialogBody>
            <Field>
              <FieldLabel>
                Type <span className="font-mono text-fg">{project.name}</span> to confirm
              </FieldLabel>
              <Input
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                autoComplete="off"
              />
            </Field>
          </DialogBody>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={pending}
              disabled={confirmation !== project.name}
              onClick={() => void remove()}
            >
              Delete permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
