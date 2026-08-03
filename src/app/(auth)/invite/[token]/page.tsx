import Link from 'next/link';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { currentUser } from '@/lib/auth';
import { previewInvitation } from '@/server/services/workspaces';
import { AcceptInvitation } from '@/components/dashboard/accept-invitation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * Landing page for an invite link.
 *
 * Lives in the auth group, not the dashboard one. The dashboard layout calls
 * `requireWorkspace()`, which redirects anyone signed out straight to /login
 * with no `next` — so an invitee who did not already have an account would
 * sign up and land on an empty dashboard, having lost the invitation they
 * clicked. Here the page runs its own redirect and brings them back.
 *
 * Deliberately not auto-accepting on load. A GET that mutates state is a
 * liability — a link preview fetcher in Slack or an email client would join
 * the workspace on the recipient's behalf before they had read anything. The
 * page shows what is on offer and waits for a click.
 */

export const metadata: Metadata = {
  title: 'Join a workspace',
  robots: { index: false, follow: false },
};

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invitation = await previewInvitation(token);
  const user = await currentUser();

  if (!user) {
    // Sign in first, then come straight back here rather than to the dashboard.
    redirect(`/login?next=${encodeURIComponent(`/invite/${token}`)}`);
  }

  const mismatch =
    invitation?.email && invitation.email !== user.email.toLowerCase() ? invitation.email : null;

  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-md items-center px-6">
      <Card className="w-full">
        {!invitation ? (
          <>
            <CardHeader>
              <CardTitle>This invitation is no longer valid</CardTitle>
              <CardDescription>
                It may have expired, already been used, or been revoked. Ask whoever invited you for
                a fresh link.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-3">
              <Button asChild variant="secondary" size="sm">
                <Link href="/dashboard">Go to your dashboard</Link>
              </Button>
            </CardContent>
          </>
        ) : mismatch ? (
          <>
            <CardHeader>
              <CardTitle>This invitation is for someone else</CardTitle>
              <CardDescription>
                It was issued to <strong className="text-fg">{mismatch}</strong>, and you are signed
                in as {user.email}. Sign in with that account to accept it.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-3">
              <Button asChild variant="secondary" size="sm">
                <Link href="/dashboard">Go to your dashboard</Link>
              </Button>
            </CardContent>
          </>
        ) : (
          <>
            <CardHeader>
              <CardTitle>Join {invitation.workspaceName}</CardTitle>
              <CardDescription>
                You have been invited as a <strong className="text-fg">{invitation.role}</strong>.
                Accepting gives you access to every project and all feedback in this workspace.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-3">
              <AcceptInvitation token={token} workspaceName={invitation.workspaceName} />
            </CardContent>
          </>
        )}
      </Card>
    </div>
  );
}
