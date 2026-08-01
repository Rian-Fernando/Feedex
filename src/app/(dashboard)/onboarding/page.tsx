import { redirect } from 'next/navigation';

import { currentUser, setActiveWorkspace } from '@/lib/auth';
import { createWorkspace } from '@/server/services/workspaces';
import { listUserWorkspaces } from '@/server/services/workspaces';

/**
 * Repair route for an account with no workspace.
 *
 * Registration always creates one, so reaching this page means something went
 * wrong earlier — most likely a workspace deleted by its last owner. Rather
 * than showing a dead end, it provisions a fresh workspace and continues.
 */
export default async function OnboardingPage() {
  const user = await currentUser();
  if (!user) redirect('/login');

  const existing = await listUserWorkspaces(user.id);

  if (existing.length > 0) {
    await setActiveWorkspace(existing[0]!.id);
    redirect('/dashboard');
  }

  const workspace = await createWorkspace({
    name: `${user.name.split(' ')[0] ?? 'My'}'s workspace`,
    ownerId: user.id,
  });

  await setActiveWorkspace(workspace.id);
  redirect('/dashboard');
}
