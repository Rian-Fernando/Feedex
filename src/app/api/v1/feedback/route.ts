import { NextResponse } from 'next/server';

import { AppError } from '@/lib/errors';
import { fieldErrorsFrom, submitFeedbackSchema } from '@/lib/validation';
import { RATE_LIMITS, consume, sweepRateLimits } from '@/lib/rate-limit';
import { apiError, clientIp, INGEST_CORS_HEADERS, withCors } from '@/lib/api/response';
import { authenticateApiKey, originAllowed, touchApiKey } from '@/server/services/api-auth';
import { ingestFeedback } from '@/server/services/feedback';
import { recordActivity } from '@/server/services/activity';

/**
 * Widget ingestion endpoint.
 *
 * This is the only unauthenticated write path in the product, so it is the one
 * that has to be defensive:
 *
 *   - the payload is validated and bounded by Zod before anything touches the
 *     database;
 *   - the public key identifies the project but grants nothing else;
 *   - the request is rate limited per IP and, separately, per project, so one
 *     leaked key cannot be used to flood a workspace;
 *   - the `Origin` header is checked against the project's declared domain as a
 *     hygiene measure (not as authentication — it is trivially forgeable off
 *     the browser).
 */

// Requires Node APIs (crypto, pg/PGlite) rather than the edge runtime.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, { status: 204, headers: INGEST_CORS_HEADERS });
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      throw AppError.validation('Expected a JSON body.');
    }

    const parsed = submitFeedbackSchema.safeParse(body);
    if (!parsed.success) {
      throw AppError.validation('Invalid feedback payload.', fieldErrorsFrom(parsed.error));
    }

    const input = parsed.data;

    const ip = clientIp(request);
    const perIp = await consume({
      key: `ingest:ip:${ip}`,
      ...RATE_LIMITS.ingestPerIp,
    });

    if (!perIp.allowed) {
      throw AppError.rateLimited('Too many submissions. Please wait a moment.');
    }

    const context = await authenticateApiKey(input.publicKey, 'public');

    const perProject = await consume({
      key: `ingest:project:${context.project.id}`,
      ...RATE_LIMITS.ingestPerProject,
    });

    if (!perProject.allowed) {
      throw AppError.rateLimited('This project is receiving too many submissions right now.');
    }

    const origin = request.headers.get('origin');
    if (!originAllowed(context.project, origin)) {
      throw AppError.forbidden('This origin is not allowed to submit feedback to this project.');
    }

    const created = await ingestFeedback({
      workspaceId: context.workspaceId,
      projectId: context.project.id,
      category: input.category,
      title: input.title,
      description: input.description,
      reporterEmail: input.email || null,
      reporterName: input.name || null,
      context: {
        ...input.context,
        // Recorded server-side so it cannot be spoofed by the payload.
        userAgent: request.headers.get('user-agent')?.slice(0, 512) ?? input.context?.userAgent,
        referrer: origin ?? input.context?.referrer,
      },
      // Dropped rather than rejected when the project has attachments switched
      // off: a stale widget on a cached page should not start failing reports
      // the moment the setting is changed in the dashboard.
      attachments:
        context.project.widgetSettings?.attachmentsEnabled === false ? [] : input.attachments,
    });

    // Post-response bookkeeping: none of it may fail the submission.
    void touchApiKey(context.keyId);
    void recordActivity({
      workspaceId: context.workspaceId,
      action: 'feedback.created',
      targetType: 'feedback',
      targetId: created.id,
      metadata: {
        title: created.title,
        category: created.category,
        projectId: context.project.id,
      },
    }).catch((error) => console.error('[feedex] activity write failed', error));
    void sweepRateLimits().catch(() => undefined);

    return withCors(
      NextResponse.json(
        {
          data: {
            id: created.id,
            reference: `#${created.reference}`,
            status: created.status,
            createdAt: created.createdAt,
          },
        },
        { status: 201 },
      ),
    );
  } catch (error) {
    return withCors(apiError(error));
  }
}
