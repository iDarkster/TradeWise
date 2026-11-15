import type { NextFunction, Request, RequestHandler, Response } from "express";
import { Prisma } from "../generated/prisma/client.js";
import { ApiError, ErrorCode } from "../utils/apiError.js";
import { sendError } from "../utils/response.js";

/**
 * Centralised error handling.
 *
 * Known error shapes are mapped to safe, stable API errors. Anything else is
 * reported as a generic internal error; the underlying exception is written
 * to the server log only, never to the response.
 */

interface BodyParserError extends Error {
  status?: number;
  statusCode?: number;
  type?: string;
  body?: unknown;
}

function isBodyParserSyntaxError(error: unknown): error is BodyParserError {
  return (
    error instanceof SyntaxError &&
    typeof error === "object" &&
    error !== null &&
    "body" in error
  );
}

/** Handles requests that did not match any route. */
export function notFoundHandler(req: Request, res: Response): void {
  sendError(
    res,
    404,
    ErrorCode.NOT_FOUND,
    `No route matches ${req.method} ${req.path}.`,
  );
}

/** Express error-handling middleware. */
export function errorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (res.headersSent) {
    next(error);
    return;
  }

  if (error instanceof ApiError) {
    sendError(res, error.status, error.code, error.message, error.details);
    return;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case "P2002":
        sendError(
          res,
          409,
          ErrorCode.CONFLICT,
          "A resource with the same unique values already exists.",
        );
        return;
      case "P2025":
        sendError(res, 404, ErrorCode.NOT_FOUND, "The requested resource was not found.");
        return;
      case "P2003":
        sendError(
          res,
          409,
          ErrorCode.CONFLICT,
          "The request conflicts with the current state of the resource.",
        );
        return;
      default:
        break;
    }
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    sendError(res, 400, ErrorCode.MALFORMED_REQUEST, "The request payload is invalid.");
    return;
  }

  if (isBodyParserSyntaxError(error)) {
    sendError(res, 400, ErrorCode.MALFORMED_REQUEST, "The request body is not valid JSON.");
    return;
  }

  // Unexpected failure: log the detail server-side, return a safe message.
  console.error("Unhandled error while processing request:", error);

  sendError(res, 500, ErrorCode.INTERNAL_ERROR, "An unexpected error occurred.");
}

/** Wraps an async handler so rejected promises reach the error middleware. */
export function asyncHandler(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    handler(req, res, next).catch(next);
  };
}
