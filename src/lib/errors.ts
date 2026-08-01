/**
 * Domain error taxonomy.
 *
 * Service functions throw these instead of returning ad-hoc shapes, so that the
 * HTTP layer, server actions, and tests can all map failures consistently. Each
 * carries a stable machine-readable `code` alongside a message safe to show to
 * an end user.
 */
export type ErrorCode =
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'validation_error'
  | 'rate_limited'
  | 'internal_error';

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  validation_error: 422,
  rate_limited: 429,
  internal_error: 500,
};

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: Record<string, string[]>;

  constructor(code: ErrorCode, message: string, details?: Record<string, string[]>) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = STATUS_BY_CODE[code];
    this.details = details;
  }

  static unauthorized(message = 'You must be signed in to do that.') {
    return new AppError('unauthorized', message);
  }

  static forbidden(message = 'You do not have access to this resource.') {
    return new AppError('forbidden', message);
  }

  static notFound(message = 'That resource could not be found.') {
    return new AppError('not_found', message);
  }

  static conflict(message: string) {
    return new AppError('conflict', message);
  }

  static validation(message: string, details?: Record<string, string[]>) {
    return new AppError('validation_error', message, details);
  }

  static rateLimited(message = 'Too many requests. Please slow down.') {
    return new AppError('rate_limited', message);
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/** Shape returned by server actions so forms can render failures uniformly. */
export interface ActionResult<T = void> {
  ok: boolean;
  data?: T;
  error?: string;
  code?: ErrorCode;
  fieldErrors?: Record<string, string[]>;
}

export function actionSuccess<T>(data?: T): ActionResult<T> {
  return { ok: true, data };
}

export function actionFailure(error: unknown): ActionResult<never> {
  if (isAppError(error)) {
    return {
      ok: false,
      error: error.message,
      code: error.code,
      fieldErrors: error.details,
    };
  }

  // Anything unrecognised is a bug; log it server-side and stay vague publicly.
  console.error('[feedex] unhandled action error', error);
  return {
    ok: false,
    error: 'Something went wrong. Please try again.',
    code: 'internal_error',
  };
}
