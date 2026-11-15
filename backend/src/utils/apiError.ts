/**
 * Stable API error codes.
 *
 * These strings are part of the public API contract. They are safe to expose
 * to clients and never contain internal details.
 */
export const ErrorCode = {
  VALIDATION_ERROR: "VALIDATION_ERROR",
  MALFORMED_REQUEST: "MALFORMED_REQUEST",
  INVALID_CREDENTIALS: "INVALID_CREDENTIALS",
  UNAUTHENTICATED: "UNAUTHENTICATED",
  FORBIDDEN: "FORBIDDEN",
  CSRF_TOKEN_INVALID: "CSRF_TOKEN_INVALID",
  NOT_FOUND: "NOT_FOUND",
  CONFLICT: "CONFLICT",
  RATE_LIMITED: "RATE_LIMITED",
  INTERNAL_ERROR: "INTERNAL_ERROR",
  SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",
} as const;

export type ErrorCodeValue = (typeof ErrorCode)[keyof typeof ErrorCode];

/**
 * An error that is safe to render to a client.
 *
 * Anything that is not an `ApiError` is treated as an unexpected failure and
 * reported with a generic message so that internal details never leak.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: ErrorCodeValue;
  readonly details: unknown;

  constructor(
    status: number,
    code: ErrorCodeValue,
    message: string,
    details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export class ValidationApiError extends ApiError {
  constructor(message: string, fields: Record<string, string>) {
    super(400, ErrorCode.VALIDATION_ERROR, message, { fields });
    this.name = "ValidationApiError";
  }
}

export class UnauthorizedError extends ApiError {
  constructor(
    message = "Authentication is required to access this resource.",
    code: ErrorCodeValue = ErrorCode.UNAUTHENTICATED,
  ) {
    super(401, code, message);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends ApiError {
  constructor(
    message = "You do not have permission to perform this action.",
    code: ErrorCodeValue = ErrorCode.FORBIDDEN,
  ) {
    super(403, code, message);
    this.name = "ForbiddenError";
  }
}

export class NotFoundError extends ApiError {
  constructor(message = "The requested resource was not found.") {
    super(404, ErrorCode.NOT_FOUND, message);
    this.name = "NotFoundError";
  }
}

export class ConflictError extends ApiError {
  constructor(message = "The request conflicts with the current state of the resource.") {
    super(409, ErrorCode.CONFLICT, message);
    this.name = "ConflictError";
  }
}

export class RateLimitError extends ApiError {
  constructor(message: string, details?: unknown) {
    super(429, ErrorCode.RATE_LIMITED, message, details);
    this.name = "RateLimitError";
  }
}
