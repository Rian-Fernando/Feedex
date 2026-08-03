'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Link2, Trash2, UserPlus } from 'lucide-react';
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
import { Field, FieldDescription, FieldLabel, Input, NativeSelect } from '@/components/ui/field';
import { CopyButton } from '@/components/ui/misc';
import { formatDate } from '@/lib/format';
import {
  inviteMemberAction,
  removeMemberAction,
  revokeInvitationAction,
  updateMemberRoleAction,
} from '@/server/actions/members';

/**
 * Who has access to this workspace.
 *
 * Invitations are links rather than emails, so this is where the link is
 * surfaced — once, at creation. Only a hash is stored, exactly as with a secret
 * API key, so there is no way to show it again afterwards; the dialog says so
 * rather than letting someone discover it by navigating away.
 */

export interface MemberRow {
  userId: string;
  name: string;
  email: string;
  role: string;
  joinedAt: Date;
}

export interface InviteRow {
  id: string;
  email: string | null;
  role: string;
  expiresAt: Date;
}

const ROLES = [
  { value: 'owner', label: 'Owner', hint: 'Full control, including deleting the workspace.' },
  { value: 'admin', label: 'Admin', hint: 'Manage projects, members, and all feedback.' },
  { value: 'member', label: 'Member', hint: 'Create projects and triage feedback.' },
  { value: 'viewer', label: 'Viewer', hint: 'Read-only access to projects and feedback.' },
];

export function MembersPanel({
  members,
  invitations,
  currentUserId,
  currentRole,
  canManage,
}: {
  members: MemberRow[];
  invitations: InviteRow[];
  currentUserId: string;
  currentRole: string;
  canManage: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [inviting, setInviting] = React.useState(false);
  const [removing, setRemoving] = React.useState<MemberRow | null>(null);

  const run = (action: Promise<{ ok: boolean; error?: string }>, success: string) => {
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

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Members</CardTitle>
          <CardDescription>
            Everyone with access to this workspace, and what they can do.
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-3">
          <ul className="divide-y divide-line-subtle">
            {members.map((member) => (
              <li key={member.userId} className="flex flex-wrap items-center gap-3 py-3 first:pt-0">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-sunken text-xs font-semibold text-fg-muted">
                  {member.name.slice(0, 1).toUpperCase()}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-fg">
                    {member.name}
                    {member.userId === currentUserId ? (
                      <span className="font-normal text-fg-subtle"> (you)</span>
                    ) : null}
                  </span>
                  <span className="block truncate text-xs text-fg-subtle">
                    {member.email} · joined {formatDate(member.joinedAt)}
                  </span>
                </span>

                {canManage && member.userId !== currentUserId ? (
                  <NativeSelect
                    aria-label={`Role for ${member.name}`}
                    value={member.role}
                    disabled={pending}
                    onChange={(event) =>
                      run(updateMemberRoleAction(member.userId, event.target.value), 'Role updated')
                    }
                    className="w-auto min-w-28"
                  >
                    {ROLES.map((role) => (
                      <option
                        key={role.value}
                        value={role.value}
                        // Only an owner can create another owner, so the option
                        // is unavailable rather than failing on submit.
                        disabled={role.value === 'owner' && currentRole !== 'owner'}
                      >
                        {role.label}
                      </option>
                    ))}
                  </NativeSelect>
                ) : (
                  <Badge tone={member.role === 'owner' ? 'accent' : 'neutral'} size="sm">
                    {member.role}
                  </Badge>
                )}

                {canManage && member.userId !== currentUserId ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`Remove ${member.name}`}
                    disabled={pending}
                    onClick={() => setRemoving(member)}
                  >
                    <Trash2 aria-hidden className="size-3.5" />
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        </CardContent>

        {canManage ? (
          <CardFooter>
            <Button variant="secondary" size="sm" onClick={() => setInviting(true)}>
              <UserPlus aria-hidden className="size-3.5" />
              Invite someone
            </Button>
          </CardFooter>
        ) : null}
      </Card>

      {invitations.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Pending invitations</CardTitle>
            <CardDescription>
              Links that have been created but not yet used. They expire automatically.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-3">
            <ul className="divide-y divide-line-subtle">
              {invitations.map((invite) => (
                <li key={invite.id} className="flex items-center gap-3 py-2.5 first:pt-0">
                  <Link2 aria-hidden className="size-4 shrink-0 text-fg-subtle" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-fg">
                      {invite.email ?? 'Anyone with the link'}
                    </span>
                    <span className="block text-xs text-fg-subtle">
                      {invite.role} · expires {formatDate(invite.expiresAt)}
                    </span>
                  </span>
                  {canManage ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={pending}
                      onClick={() => run(revokeInvitationAction(invite.id), 'Invitation revoked')}
                    >
                      Revoke
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <InviteDialog
        open={inviting}
        onOpenChange={setInviting}
        canInviteOwner={currentRole === 'owner'}
      />

      {removing ? (
        <Dialog open onOpenChange={(open) => !open && setRemoving(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Remove {removing.name}?</DialogTitle>
              <DialogDescription>
                They lose access to every project and all feedback in this workspace immediately.
                Anything they wrote stays.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setRemoving(null)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={() => {
                  const target = removing;
                  setRemoving(null);
                  run(removeMemberAction(target.userId), `${target.name} removed`);
                }}
              >
                Remove
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </>
  );
}

function InviteDialog({
  open,
  onOpenChange,
  canInviteOwner,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canInviteOwner: boolean;
}) {
  const router = useRouter();
  const [state, formAction, pending] = React.useActionState(inviteMemberAction, {
    ok: false,
  } as Awaited<ReturnType<typeof inviteMemberAction>>);

  const link = state.ok ? state.data : null;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next && link) router.refresh();
      }}
    >
      <DialogContent>
        {link ? (
          <>
            <DialogHeader>
              <DialogTitle>Invitation ready</DialogTitle>
              <DialogDescription>
                Send this link to {link.email ?? 'whoever should join'}. It works once and expires
                in seven days.
              </DialogDescription>
            </DialogHeader>

            <DialogBody>
              <div className="relative">
                <pre className="scrollbar-thin overflow-x-auto rounded-lg border border-line-subtle bg-surface-sunken p-3 pr-12 text-xs">
                  <code className="font-mono text-fg-muted">{link.url}</code>
                </pre>
                <CopyButton
                  value={link.url}
                  label="Copy the invitation link"
                  className="absolute top-2 right-2 border border-line-subtle bg-surface-raised"
                />
              </div>
              {/*
                Stated plainly, because only a hash of the token is stored and
                there is genuinely no way to retrieve this afterwards.
              */}
              <p className="mt-2 text-xs text-fg-subtle">
                This link is shown once. If you lose it, revoke the invitation and create another.
              </p>
            </DialogBody>

            <DialogFooter>
              <Button
                onClick={() => {
                  onOpenChange(false);
                  router.refresh();
                }}
              >
                Done
              </Button>
            </DialogFooter>
          </>
        ) : (
          <form action={formAction}>
            <DialogHeader>
              <DialogTitle>Invite someone</DialogTitle>
              <DialogDescription>
                Feedex creates a link rather than sending an email — paste it wherever you already
                talk to them.
              </DialogDescription>
            </DialogHeader>

            <DialogBody className="flex flex-col gap-4">
              <Field>
                <FieldLabel optional>Email</FieldLabel>
                <Input name="email" type="email" placeholder="teammate@example.com" />
                <FieldDescription>
                  Restricts the link to this address, so forwarding it grants nobody else access.
                  Leave blank for a link anyone can use once.
                </FieldDescription>
              </Field>

              <Field>
                <FieldLabel>Role</FieldLabel>
                <NativeSelect name="role" defaultValue="member">
                  {ROLES.filter((role) => role.value !== 'owner' || canInviteOwner).map((role) => (
                    <option key={role.value} value={role.value}>
                      {role.label} — {role.hint}
                    </option>
                  ))}
                </NativeSelect>
              </Field>

              {!state.ok && state.error ? (
                <p className="text-sm text-danger-500">{state.error}</p>
              ) : null}
            </DialogBody>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={pending}>
                Create link
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
