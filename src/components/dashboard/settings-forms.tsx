'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Moon, Sun, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { cn } from '@/lib/cn';
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
import { Field, FieldDescription, FieldLabel, Input, NativeSelect } from '@/components/ui/field';
import { useTheme, type Theme } from '@/components/theme-provider';
import { FEEDBACK_PRIORITIES, PROJECT_ENVIRONMENTS } from '@/lib/taxonomy';
import {
  changePasswordAction,
  deleteWorkspaceAction,
  updateProfileAction,
  updateWorkspaceAction,
} from '@/server/actions/settings';
import type { ActionResult } from '@/lib/errors';
import type { WorkspaceSettings } from '@/lib/db/schema';

const INITIAL: ActionResult = { ok: false };

export function ProfileForm({ user }: { user: { name: string; email: string } }) {
  const router = useRouter();
  const [state, formAction, pending] = React.useActionState(updateProfileAction, INITIAL);

  React.useEffect(() => {
    if (state.ok) {
      toast.success('Profile updated');
      router.refresh();
    }
  }, [state, router]);

  return (
    <Card>
      <form action={formAction}>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>How you appear across the workspace.</CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col gap-4 pt-4">
          {state.error && state.code !== 'validation_error' ? (
            <p role="alert" className="text-sm text-danger-500">
              {state.error}
            </p>
          ) : null}

          <Field error={state.fieldErrors?.name}>
            <FieldLabel>Name</FieldLabel>
            <Input name="name" defaultValue={user.name} required maxLength={120} />
          </Field>

          <Field error={state.fieldErrors?.email}>
            <FieldLabel>Email</FieldLabel>
            <Input name="email" type="email" defaultValue={user.email} required />
            <FieldDescription>Used to sign in.</FieldDescription>
          </Field>
        </CardContent>

        <CardFooter className="justify-end">
          <Button type="submit" size="sm" loading={pending}>
            Save profile
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

export function PasswordForm() {
  const formRef = React.useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = React.useActionState(changePasswordAction, INITIAL);

  React.useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
      toast.success('Password changed', {
        description: 'Any other signed-in sessions have been ended.',
      });
    }
  }, [state]);

  return (
    <Card>
      <form ref={formRef} action={formAction}>
        <CardHeader>
          <CardTitle>Password</CardTitle>
          <CardDescription>Changing your password signs out every other device.</CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col gap-4 pt-4">
          {state.error && state.code !== 'validation_error' ? (
            <p role="alert" className="text-sm text-danger-500">
              {state.error}
            </p>
          ) : null}

          <Field error={state.fieldErrors?.currentPassword}>
            <FieldLabel>Current password</FieldLabel>
            <Input
              name="currentPassword"
              type="password"
              autoComplete="current-password"
              required
            />
          </Field>

          <Field error={state.fieldErrors?.newPassword}>
            <FieldLabel>New password</FieldLabel>
            <Input
              name="newPassword"
              type="password"
              autoComplete="new-password"
              minLength={10}
              required
            />
            <FieldDescription>At least 10 characters.</FieldDescription>
          </Field>

          <Field error={state.fieldErrors?.confirmPassword}>
            <FieldLabel>Confirm new password</FieldLabel>
            <Input name="confirmPassword" type="password" autoComplete="new-password" required />
          </Field>
        </CardContent>

        <CardFooter className="justify-end">
          <Button type="submit" size="sm" loading={pending}>
            Change password
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

const THEMES: Array<{ value: Theme; label: string; icon: typeof Sun }> = [
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'light', label: 'Light', icon: Sun },
];

export function AppearanceForm() {
  const { theme, setTheme } = useTheme();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Appearance</CardTitle>
        <CardDescription>
          Dark by default. Applies to this browser, and to the dashboard only — the marketing site
          is always dark.
        </CardDescription>
      </CardHeader>

      <CardContent className="pt-4">
        <fieldset>
          <legend className="sr-only">Theme</legend>
          <div className="grid max-w-sm gap-3 sm:grid-cols-2">
            {THEMES.map((option) => (
              <label
                key={option.value}
                className={cn(
                  'flex cursor-pointer flex-col items-center gap-2 rounded-lg border p-4 transition-colors',
                  theme === option.value
                    ? 'border-accent-500 bg-accent-500/8 text-fg'
                    : 'border-line text-fg-muted hover:border-line-strong hover:bg-surface-inset/50',
                )}
              >
                <input
                  type="radio"
                  name="theme"
                  value={option.value}
                  checked={theme === option.value}
                  onChange={() => setTheme(option.value)}
                  className="sr-only"
                />
                <option.icon aria-hidden className="size-5" />
                <span className="text-sm font-medium">{option.label}</span>
              </label>
            ))}
          </div>
        </fieldset>
      </CardContent>
    </Card>
  );
}

export function WorkspaceForm({
  name,
  settings,
  canEdit,
}: {
  name: string;
  settings: WorkspaceSettings;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [state, formAction, pending] = React.useActionState(updateWorkspaceAction, INITIAL);

  React.useEffect(() => {
    if (state.ok) {
      toast.success('Workspace updated');
      router.refresh();
    }
  }, [state, router]);

  return (
    <Card>
      <form action={formAction}>
        <CardHeader>
          <CardTitle>Workspace</CardTitle>
          <CardDescription>Defaults applied to new projects and incoming feedback.</CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col gap-4 pt-4">
          {state.error && state.code !== 'validation_error' ? (
            <p role="alert" className="text-sm text-danger-500">
              {state.error}
            </p>
          ) : null}

          <Field error={state.fieldErrors?.name}>
            <FieldLabel>Workspace name</FieldLabel>
            <Input name="name" defaultValue={name} required disabled={!canEdit} maxLength={120} />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel>Default priority</FieldLabel>
              <NativeSelect
                name="defaultPriority"
                defaultValue={settings.defaultPriority ?? 'medium'}
                disabled={!canEdit}
              >
                {FEEDBACK_PRIORITIES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </NativeSelect>
            </Field>

            <Field>
              <FieldLabel>Default environment</FieldLabel>
              <NativeSelect
                name="defaultEnvironment"
                defaultValue={settings.defaultEnvironment ?? 'production'}
                disabled={!canEdit}
              >
                {PROJECT_ENVIRONMENTS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          </div>

          {!canEdit ? (
            <p className="text-xs text-fg-subtle">
              Your role does not permit changing workspace settings.
            </p>
          ) : null}
        </CardContent>

        <CardFooter className="justify-end">
          <Button type="submit" size="sm" loading={pending} disabled={!canEdit}>
            Save workspace
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

export function WorkspaceDangerZone({ workspaceName }: { workspaceName: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [confirmation, setConfirmation] = React.useState('');
  const [pending, setPending] = React.useState(false);

  async function remove() {
    setPending(true);
    const result = await deleteWorkspaceAction(confirmation);
    setPending(false);

    if (!result.ok) {
      toast.error(result.error ?? 'Could not delete the workspace.');
      return;
    }

    toast.success('Workspace deleted');
    router.push('/');
    router.refresh();
  }

  return (
    <>
      <Card className="border-danger-500/25">
        <CardHeader>
          <CardTitle className="text-danger-500">Danger zone</CardTitle>
          <CardDescription>
            Deleting this workspace permanently removes every project, feedback item, note, and key
            inside it.
          </CardDescription>
        </CardHeader>
        <CardFooter className="justify-end">
          <Button variant="danger" size="sm" onClick={() => setOpen(true)}>
            <Trash2 aria-hidden className="size-3.5" />
            Delete workspace
          </Button>
        </CardFooter>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete {workspaceName}?</DialogTitle>
            <DialogDescription>
              Everything in this workspace is removed. This cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <DialogBody>
            <Field>
              <FieldLabel>
                Type <span className="font-mono text-fg">{workspaceName}</span> to confirm
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
              disabled={confirmation !== workspaceName}
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
