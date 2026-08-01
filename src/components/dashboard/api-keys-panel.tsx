'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Eye, EyeOff, KeyRound, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { CopyButton } from '@/components/ui/misc';
import { Badge } from '@/components/ui/badge';
import { rotateKeyAction } from '@/server/actions/projects';
import { formatDate, timeAgo } from '@/lib/format';
import type { ApiKeyView } from '@/server/services/projects';

/**
 * Key management.
 *
 * Public keys are displayed in full because they ship in client-side snippets
 * and are not secrets. Secret keys are only ever shown at the moment they are
 * generated — after that the server holds nothing but an HMAC, so there is
 * genuinely nothing left to reveal.
 */
export function ApiKeysPanel({ projectId, keys }: { projectId: string; keys: ApiKeyView[] }) {
  const router = useRouter();
  const [revealed, setRevealed] = React.useState(false);
  const [rotating, setRotating] = React.useState<'public' | 'secret' | null>(null);
  // Populated only by a rotation performed in this browser tab. A page reload
  // clears it, because the server has no plaintext copy to send back.
  const [newSecret, setNewSecret] = React.useState<string | null>(null);
  const [confirm, setConfirm] = React.useState<'public' | 'secret' | null>(null);

  const publicKey = keys.find((key) => key.type === 'public');
  const secretKey = keys.find((key) => key.type === 'secret');

  async function rotate(type: 'public' | 'secret') {
    setConfirm(null);
    setRotating(type);

    const result = await rotateKeyAction(projectId, type);

    setRotating(null);

    if (!result.ok) {
      toast.error(result.error ?? 'Could not rotate the key.');
      return;
    }

    if (type === 'secret' && result.data) {
      setNewSecret(result.data.token);
    }

    toast.success(`${type === 'public' ? 'Public' : 'Secret'} key rotated`, {
      description:
        type === 'public'
          ? 'Update the snippet on your site — the previous key no longer works.'
          : 'Copy the new key now. It will not be shown again.',
    });

    router.refresh();
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>API keys</CardTitle>
          <CardDescription>
            The public key identifies your project in the widget. The secret key authenticates
            server-to-server API calls.
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col gap-4 pt-4">
          {publicKey ? (
            <div className="flex flex-col gap-2 rounded-lg border border-line-subtle p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <KeyRound aria-hidden className="size-3.5 text-fg-subtle" />
                  <span className="text-sm font-medium text-fg">Public key</span>
                  <Badge tone="info" size="sm">
                    Client-side
                  </Badge>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  loading={rotating === 'public'}
                  onClick={() => setConfirm('public')}
                >
                  <RefreshCw aria-hidden className="size-3.5" />
                  Rotate
                </Button>
              </div>

              <div className="flex items-center gap-2 rounded-md bg-surface-sunken px-3 py-2">
                <code className="break-anywhere flex-1 font-mono text-xs text-fg-muted">
                  {publicKey.publicValue}
                </code>
                <CopyButton value={publicKey.publicValue ?? ''} label="Copy public key" />
              </div>

              <p className="text-xs text-fg-subtle">
                Safe to embed in client-side code. Created {formatDate(publicKey.createdAt)}
                {publicKey.lastUsedAt
                  ? ` · last used ${timeAgo(publicKey.lastUsedAt)}`
                  : ' · never used'}
                .
              </p>
            </div>
          ) : null}

          {secretKey ? (
            <div className="flex flex-col gap-2 rounded-lg border border-line-subtle p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <KeyRound aria-hidden className="size-3.5 text-fg-subtle" />
                  <span className="text-sm font-medium text-fg">Secret key</span>
                  <Badge tone="danger" size="sm">
                    Server-side only
                  </Badge>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  loading={rotating === 'secret'}
                  onClick={() => setConfirm('secret')}
                >
                  <RefreshCw aria-hidden className="size-3.5" />
                  Rotate
                </Button>
              </div>

              <div className="flex items-center gap-2 rounded-md bg-surface-sunken px-3 py-2">
                <code className="break-anywhere flex-1 font-mono text-xs text-fg-muted">
                  {newSecret && revealed ? newSecret : `${secretKey.keyPrefix}${'•'.repeat(20)}`}
                </code>
                {newSecret ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setRevealed((value) => !value)}
                      aria-label={revealed ? 'Hide secret key' : 'Reveal secret key'}
                      className="inline-flex size-8 items-center justify-center rounded-md text-fg-subtle transition-colors hover:bg-surface-inset hover:text-fg"
                    >
                      {revealed ? (
                        <EyeOff aria-hidden className="size-3.5" />
                      ) : (
                        <Eye aria-hidden className="size-3.5" />
                      )}
                    </button>
                    <CopyButton value={newSecret} label="Copy secret key" />
                  </>
                ) : null}
              </div>

              <p className="text-xs text-fg-subtle">
                {newSecret
                  ? 'Copy this now — it is not stored and cannot be shown again.'
                  : 'Only stored as a hash. Rotate to generate a new one.'}
              </p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Dialog open={confirm !== null} onOpenChange={(open) => !open && setConfirm(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Rotate the {confirm} key?</DialogTitle>
            <DialogDescription>
              {confirm === 'public'
                ? 'The current key stops working immediately. Any site still using it will fail to submit feedback until you update the snippet.'
                : 'The current key stops working immediately. Any integration using it will start receiving 401 responses.'}
            </DialogDescription>
          </DialogHeader>

          <DialogBody>
            <div className="flex items-start gap-2 rounded-lg border border-warning-500/25 bg-warning-500/10 px-3 py-2.5 text-sm text-warning-600 dark:text-warning-400">
              <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" />
              <span>This cannot be undone.</span>
            </div>
          </DialogBody>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirm(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => confirm && void rotate(confirm)}>
              Rotate key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
