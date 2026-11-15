import type { Response } from "express";
import type { ErrorCodeValue } from "./apiError.js";

export interface SuccessEnvelope<T> {
  success: true;
  data: T;
}

export interface ErrorEnvelope {
  success: false;
  error: {
    code: ErrorCodeValue;
    message: string;
    details?: unknown;
  };
}

/** Sends a successful response using the shared envelope. */
export function sendSuccess<T>(res: Response, data: T, status = 200): void {
  const envelope: SuccessEnvelope<T> = { success: true, data };

  res.status(status).json(envelope);
}

/** Sends an error response using the shared envelope. */
export function sendError(
  res: Response,
  status: number,
  code: ErrorCodeValue,
  message: string,
  details?: unknown,
): void {
  const error: ErrorEnvelope["error"] = { code, message };

  if (details !== undefined) {
    error.details = details;
  }

  res.status(status).json({ success: false, error } satisfies ErrorEnvelope);
}
