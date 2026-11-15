import type { ApiErrorDetail } from "../../types/api.js";

/**
 * Standard client-side application error representing an HTTP API failure.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, error: ApiErrorDetail) {
    super(error.message || `API request failed with status ${status}`);
    this.name = "ApiError";
    this.status = status;
    this.code = error.code || "UNKNOWN_ERROR";
    this.details = error.details;
  }
}
