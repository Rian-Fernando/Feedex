import { NextResponse } from 'next/server';

import { isAppError } from '@/lib/errors';

/**
 * Uniform JSON envelope for the public API.
 *
 * Every endpoint answers with either `{ data }` or `{ error: { code, message } }`
 * so a client can branch on one shape regardless of which route it called.
 */

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: Record<string, string[]>;
  };
}

export function apiSuccess<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json({ data }, { status: 200, ...init });
}

export function apiError(error: unknown, fallbackStatus = 500): NextResponse<ApiErrorBody> {
  if (isAppError(error)) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message, details: error.details } },
      { status: error.status },
    );
  }

  console.error('[feedex] unhandled api error', error);

  return NextResponse.json(
    { error: { code: 'internal_error', message: 'An unexpected error occurred.' } },
    { status: fallbackStatus },
  );
}

/**
 * CORS headers for the ingestion endpoint.
 *
 * The widget runs on origins Feedex cannot enumerate ahead of time, so this is
 * deliberately open. It is safe because the endpoint accepts only a public key
 * whose sole capability is creating feedback for one project, carries no
 * credentials (`Allow-Credentials` is never set, and the widget sends no
 * cookies), and is rate limited per IP and per project.
 */
export const INGEST_CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

export function withCors(response: NextResponse): NextResponse {
  for (const [key, value] of Object.entries(INGEST_CORS_HEADERS)) {
    response.headers.set(key, value);
  }
  return response;
}

/** Extracts a bearer token from an Authorization header. */
export function bearerToken(request: Request): string | null {
  const header = request.headers.get('authorization');
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match?.[1]?.trim() ?? null;
}

/** Best-effort client IP, used only for rate limiting. */
export function clientIp(request: Request): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    'unknown'
  );
}
