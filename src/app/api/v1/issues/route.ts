import { NextResponse } from 'next/server';

import { AppError } from '@/lib/errors';
import { feedbackFilterSchema } from '@/lib/validation';
import { RATE_LIMITS, consume } from '@/lib/rate-limit';
import { apiError, apiSuccess, bearerToken } from '@/lib/api/response';
import { authenticateApiKey, touchApiKey } from '@/server/services/api-auth';
import { listFeedback } from '@/server/services/feedback';

/**
 * Read API for a project's feedback, authenticated with a secret key.
 *
 * Scoped to the key's own project rather than its workspace: a secret key is
 * issued per project, and widening its reach to sibling projects would make key
 * rotation a workspace-wide event.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const token = bearerToken(request);
    if (!token) {
      throw AppError.unauthorized('Provide a secret key as a bearer token.');
    }

    const context = await authenticateApiKey(token, 'secret');

    const limit = await consume({
      key: `api:key:${context.keyId}`,
      ...RATE_LIMITS.apiPerKey,
    });

    if (!limit.allowed) {
      throw AppError.rateLimited();
    }

    const url = new URL(request.url);
    const parsed = feedbackFilterSchema.safeParse(Object.fromEntries(url.searchParams));
    if (!parsed.success) {
      throw AppError.validation('Invalid query parameters.');
    }

    const result = await listFeedback(context.workspaceId, {
      ...parsed.data,
      // The key's project always wins over a caller-supplied projectId.
      projectId: context.project.id,
    });

    void touchApiKey(context.keyId);

    const response = apiSuccess({
      items: result.items.map((item) => ({
        id: item.id,
        reference: item.reference,
        title: item.title,
        description: item.description,
        category: item.category,
        status: item.status,
        priority: item.priority,
        tags: item.tags,
        reporter: item.reporterEmail
          ? { email: item.reporterEmail, name: item.reporterName }
          : null,
        context: item.context,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        resolvedAt: item.resolvedAt,
      })),
      pagination: {
        page: result.page,
        perPage: result.perPage,
        total: result.total,
        totalPages: result.totalPages,
      },
    });

    response.headers.set('X-RateLimit-Limit', String(RATE_LIMITS.apiPerKey.limit));
    response.headers.set('X-RateLimit-Remaining', String(limit.remaining));
    response.headers.set('X-RateLimit-Reset', limit.resetAt.toISOString());

    return response;
  } catch (error) {
    return apiError(error);
  }
}
