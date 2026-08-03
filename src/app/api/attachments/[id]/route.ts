import { NextResponse } from 'next/server';

import { requireWorkspaceOrThrow } from '@/lib/auth';
import { apiError } from '@/lib/api/response';
import { AppError } from '@/lib/errors';
import { getAttachment } from '@/server/services/feedback';
import { isInlineImage } from '@/lib/attachments';

/**
 * Serves an attachment to a signed-in member of the workspace that owns it.
 *
 * Attachments are user-submitted bytes served back from the application's own
 * origin, which is the classic setup for a stored cross-site scripting bug. The
 * defences, in order:
 *
 *   - the type allowlist at ingestion excludes SVG and HTML entirely, so no
 *     accepted type can carry script in the first place;
 *   - `nosniff` stops a browser from second-guessing the declared type;
 *   - anything that is not a plain image is sent as a download rather than
 *     rendered, so it never executes in a document context;
 *   - a `sandbox` CSP with `default-src 'none'` neuters anything that somehow
 *     did get rendered.
 *
 * Tenant isolation is the query's job, not a check layered on top of it: the
 * lookup is scoped to the caller's workspace, so an id belonging to another
 * tenant is simply not found.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    // The throwing guard, not the redirecting one: this is an API route, and a
    // redirect thrown here would surface as an unhandled 500 rather than the
    // 401 a client can actually act on.
    const context = await requireWorkspaceOrThrow();
    const attachment = await getAttachment(context.workspaceId, (await params).id);

    if (!attachment) throw AppError.notFound('Attachment not found.');

    const inline = isInlineImage(attachment.mimeType);
    // Quote-escaped so a crafted filename cannot break out of the header value.
    const filename = attachment.name.replace(/["\\]/g, '_');

    return new NextResponse(Buffer.from(attachment.data, 'base64'), {
      status: 200,
      headers: {
        'Content-Type': attachment.mimeType,
        'Content-Length': String(attachment.size),
        'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="${filename}"`,
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'none'; sandbox",
        // Private: this is tenant data behind a session, and must never be held
        // in a shared cache where the next request could be served it.
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
