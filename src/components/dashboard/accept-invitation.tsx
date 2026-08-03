'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { acceptInvitationAction } from '@/server/actions/members';

/** Accept button. The action is a POST, so the link itself never mutates. */
export function AcceptInvitation({
  token,
  workspaceName,
}: {
  token: string;
  workspaceName: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  return (
    <Button
      loading={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await acceptInvitationAction(token);

          if (!result.ok) {
            toast.error(result.error ?? 'That invitation could not be accepted.');
            return;
          }

          toast.success(`You have joined ${workspaceName}`);
          router.push('/dashboard');
        })
      }
    >
      Join {workspaceName}
    </Button>
  );
}
