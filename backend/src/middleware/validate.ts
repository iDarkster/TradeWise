import type { Request, RequestHandler } from "express";
import {
  parsePartialShape,
  parseShape,
  type ParseShapeOptions,
  type Shape,
} from "../utils/validation.js";

/**
 * Request validation middleware.
 *
 * The parsed result replaces the raw input so that controllers always work
 * with validated, normalised values.
 */

export interface ValidatedRequest extends Request {
  validatedBody?: unknown;
  validatedQuery?: unknown;
  validatedParams?: unknown;
}

/** Returns the validated body, throwing if the route was not validated. */
export function validatedBody<T>(req: Request): T {
  if (req.validatedBody === undefined) {
    throw new Error("Request body was not validated.");
  }

  return req.validatedBody as T;
}
/** Returns the validated query, throwing if the route was not validated. */
export function validatedQuery<T>(req: Request): T {
  if (req.validatedQuery === undefined) {
    throw new Error("Request query was not validated.");
  }

  return req.validatedQuery as T;
}

/** Returns the validated path parameters, throwing if the route was not validated. */
export function validatedParams<T>(req: Request): T {
  if (req.validatedParams === undefined) {
    throw new Error("Request parameters were not validated.");
  }

  return req.validatedParams as T;
}

/** Validates the JSON request body against a shape. */
export function validateBody<S extends Shape>(
  shape: S,
  options: Omit<ParseShapeOptions, "partial"> = {},
): RequestHandler {
  return (req, _res, next) => {
    req.validatedBody = parseShape(shape, req.body, options);
    next();
  };
}

/**
 * Validates the request body as a partial update.
 *
 * Only the keys that are actually present are validated; absent keys mean
 * "leave unchanged".
 */
export function validatePartialBody<S extends Shape>(
  shape: S,
  options: Omit<ParseShapeOptions, "partial"> = {},
): RequestHandler {
  return (req, _res, next) => {
    req.validatedBody = parsePartialShape(shape, req.body, options);
    next();
  };
}

/** Validates the query string against a shape. */
export function validateQuery<S extends Shape>(
  shape: S,
  options: Omit<ParseShapeOptions, "partial"> = {},
): RequestHandler {
  return (req, _res, next) => {
    req.validatedQuery = parseShape(shape, req.query, options);
    next();
  };
}

/** Validates the path parameters against a shape. */
export function validateParams<S extends Shape>(
  shape: S,
  options: Omit<ParseShapeOptions, "partial"> = {},
): RequestHandler {
  return (req, _res, next) => {
    req.validatedParams = parseShape(shape, req.params, options);
    next();
  };
}
