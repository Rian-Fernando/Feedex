import { NextResponse } from 'next/server';

import { AppError } from '@/lib/errors';
import { apiError, INGEST_CORS_HEADERS, withCors } from '@/lib/api/response';
import { authenticateApiKey } from '@/server/services/api-auth';
import {
  ATTACHMENT_ACCEPT,
  MAX_ATTACHMENTS,
  MAX_ATTACHMENTS_TOTAL_BYTES,
  MAX_ATTACHMENT_BYTES,
} from '@/lib/attachments';

/**
 * Per-project widget configuration.
 *
 * This is what makes the appearance settings in the dashboard mean anything.
 * Without it, the only way to restyle a widget would be to edit the snippet on
 * the host site and redeploy it — which defeats the point of a hosted service,
 * and is exactly the kind of change a developer will not make for a colour.
 * With it, saving in the dashboard changes every embed on the next page load.
 *
 * Everything returned here is already public by construction: it is read with a
 * publishable key, and every value ends up rendered into the widget's DOM on
 * the host page anyway. Nothing project-private — domain, secret keys, feedback
 * counts, workspace identity — is exposed.
 *
 * Cached at the edge. The widget is on the critical path of somebody else's
 * page load, so a config fetch must not become a database round trip per
 * visitor; a minute of staleness on a button colour is a fair trade, and
 * `stale-while-revalidate` means the slow path is never on a user's request.
 */

export const runtime = 'nodejs';

export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, { status: 204, headers: INGEST_CORS_HEADERS });
}

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const key = new URL(request.url).searchParams.get('key');
    if (!key) throw AppError.validation('A project key is required.');

    const context = await authenticateApiKey(key, 'public');
    const settings = context.project.widgetSettings ?? {};

    const response = withCors(
      NextResponse.json({
        data: {
          project: { name: context.project.name },
          widget: {
            position: settings.position,
            accentColor: settings.accentColor ?? context.project.color,
            buttonLabel: settings.buttonLabel,
            launcherIcon: settings.launcherIcon,
            title: settings.title,
            description: settings.description,
            successMessage: settings.successMessage,
            requireEmail: settings.requireEmail,
            categories: settings.categories,
            theme: settings.theme,
            attachments: {
              // Defaults on, so a project created before this existed gets the
              // feature without anyone having to go and switch it on.
              enabled: settings.attachmentsEnabled !== false,
              maxCount: MAX_ATTACHMENTS,
              maxBytes: MAX_ATTACHMENT_BYTES,
              maxTotalBytes: MAX_ATTACHMENTS_TOTAL_BYTES,
              accept: ATTACHMENT_ACCEPT,
            },
          },
        },
      }),
    );

    response.headers.set(
      'Cache-Control',
      'public, max-age=60, s-maxage=300, stale-while-revalidate=86400',
    );
    return response;
  } catch (error) {
    return withCors(apiError(error));
  }
}
