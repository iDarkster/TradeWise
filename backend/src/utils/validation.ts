import { ApiError, ErrorCode } from "./apiError.js";

/**
 * Reusable runtime validation helpers.
 *
 * Hand-written on purpose: the project does not depend on a schema library.
 * Every helper is total — it either returns a value of the declared type or
 * throws. `parseShape` collects *all* field failures so clients receive a
 * complete, field-level error report in one round trip.
 */

export type FieldErrors = Record<string, string>;

/** Raised when one field fails to parse. */
class FieldError extends Error {
  constructor(
    readonly field: string,
    readonly message: string,
  ) {
    super(message);
    this.name = "FieldError";
  }
}

/** Raised when an object fails validation. Carries per-field messages. */
export class ValidationFailure extends ApiError {
  constructor(readonly fields: FieldErrors) {
    super(400, ErrorCode.VALIDATION_ERROR, "Request validation failed.", {
      fields,
    });
    this.name = "ValidationFailure";
  }
}

export interface Validator<T> {
  parse(value: unknown, field: string): T;
  /** True when the key may be omitted entirely. */
  readonly optional: boolean;
}

class ValidatorImpl<T> implements Validator<T> {
  readonly optional: boolean;

  constructor(
    private readonly parser: (value: unknown, field: string) => T,
    optional = false,
  ) {
    this.optional = optional;
  }

  parse(value: unknown, field: string): T {
    return this.parser(value, field);
  }
}

function fail(field: string, message: string): never {
  throw new FieldError(field, message);
}

function expectString(value: unknown, field: string): string {
  if (typeof value !== "string") {
    fail(field, "Must be a string.");
  }

  return value;
}

/* -------------------------------------------------------------------------- */
/* Scalar validators                                                          */
/* -------------------------------------------------------------------------- */

export interface StringOptions {
  min?: number;
  max?: number;
  pattern?: RegExp;
  patternMessage?: string;
  /** Trim surrounding whitespace before validating. */
  trim?: boolean;
}

export function stringValue(options: StringOptions = {}): Validator<string> {
  return new ValidatorImpl<string>((value, field) => {
    let parsed = expectString(value, field);

    if (options.trim) {
      parsed = parsed.trim();
    }

    if (options.min !== undefined && parsed.length < options.min) {
      fail(field, `Must be at least ${options.min} characters long.`);
    }

    if (options.max !== undefined && parsed.length > options.max) {
      fail(field, `Must be at most ${options.max} characters long.`);
    }

    if (options.pattern && !options.pattern.test(parsed)) {
      fail(field, options.patternMessage ?? "Has an invalid format.");
    }

    return parsed;
  });
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

/**
 * Validates and canonicalises an email address.
 *
 * Surrounding whitespace is removed and the result is lower-cased, so the
 * stored value is canonical and case-insensitive uniqueness holds.
 */
export function emailValue(): Validator<string> {
  return new ValidatorImpl<string>((value, field) => {
    const trimmed = expectString(value, field).trim();

    if (trimmed.length === 0) {
      fail(field, "Must not be empty.");
    }

    if (trimmed.length > 254) {
      fail(field, "Must be at most 254 characters long.");
    }

    if (!EMAIL_PATTERN.test(trimmed)) {
      fail(field, "Must be a valid email address.");
    }

    return trimmed.toLowerCase();
  });
}

const USERNAME_PATTERN = /^[A-Za-z0-9_]+$/;

/** 3-20 characters, letters, digits and underscore only. */
export function usernameValue(): Validator<string> {
  return new ValidatorImpl<string>((value, field) => {
    const trimmed = expectString(value, field).trim();

    if (trimmed.length < 3 || trimmed.length > 20) {
      fail(field, "Must be between 3 and 20 characters long.");
    }

    if (!USERNAME_PATTERN.test(trimmed)) {
      fail(field, "May only contain letters, numbers and underscores.");
    }

    return trimmed;
  });
}

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

/**
 * Password policy: 8-128 characters, at least one digit and at least one
 * special character. Upper and lower case are not required. Spaces and
 * whitespace characters are strictly forbidden anywhere in the password.
 * The password is never trimmed or otherwise mutated.
 */
export function passwordValue(): Validator<string> {
  return new ValidatorImpl<string>((value, field) => {
    const parsed = expectString(value, field);

    if (parsed.length < PASSWORD_MIN_LENGTH) {
      fail(field, `Must be at least ${PASSWORD_MIN_LENGTH} characters long.`);
    }

    if (parsed.length > PASSWORD_MAX_LENGTH) {
      fail(field, `Must be at most ${PASSWORD_MAX_LENGTH} characters long.`);
    }

    if (/\s/.test(parsed)) {
      fail(field, "Must not contain whitespace.");
    }

    if (!/\d/.test(parsed)) {
      fail(field, "Must contain at least one digit.");
    }

    if (!/[^A-Za-z0-9]/.test(parsed)) {
      fail(field, "Must contain at least one special character.");
    }

    return parsed;
  });
}

/**
 * Validates a display name.
 *
 * Bounded, trimmed and free of control characters.
 */
export function fullNameValue(): Validator<string> {
  return new ValidatorImpl<string>((value, field) => {
    const trimmed = expectString(value, field).trim();

    if (trimmed.length === 0) {
      fail(field, "Must not be empty.");
    }

    if (trimmed.length > 100) {
      fail(field, "Must be at most 100 characters long.");
    }

    // eslint-disable-next-line no-control-regex
    if (/[\u0000-\u001F\u007F]/.test(trimmed)) {
      fail(field, "Must not contain control characters.");
    }

    return trimmed;
  });
}

/** Validates an absolute http(s) URL. */
export function urlValue(): Validator<string> {
  return new ValidatorImpl<string>((value, field) => {
    const trimmed = expectString(value, field).trim();

    if (trimmed.length === 0) {
      fail(field, "Must not be empty.");
    }

    if (trimmed.length > 2048) {
      fail(field, "Must be at most 2048 characters long.");
    }

    let parsed: URL;

    try {
      parsed = new URL(trimmed);
    } catch {
      fail(field, "Must be a valid URL.");
    }

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      fail(field, "Must be an http or https URL.");
    }

    return trimmed;
  });
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function uuidValue(): Validator<string> {
  return new ValidatorImpl<string>((value, field) => {
    const trimmed = expectString(value, field).trim();

    if (!UUID_PATTERN.test(trimmed)) {
      fail(field, "Must be a valid identifier.");
    }

    return trimmed.toLowerCase();
  });
}

export interface IntOptions {
  min?: number;
  max?: number;
}

/** Parses an integer. Query-string values arrive as strings. */
export function intValue(options: IntOptions = {}): Validator<number> {
  return new ValidatorImpl<number>((value, field) => {
    let parsed: number;

    if (typeof value === "number") {
      parsed = value;
    } else if (typeof value === "string" && /^-?\d+$/.test(value.trim())) {
      parsed = Number(value.trim());
    } else {
      fail(field, "Must be an integer.");
    }

    if (!Number.isSafeInteger(parsed)) {
      fail(field, "Must be an integer.");
    }

    if (options.min !== undefined && parsed < options.min) {
      fail(field, `Must be greater than or equal to ${options.min}.`);
    }

    if (options.max !== undefined && parsed > options.max) {
      fail(field, `Must be less than or equal to ${options.max}.`);
    }

    return parsed;
  });
}

/** Parses an ISO-8601 date from a query string. */
export function dateValue(): Validator<Date> {
  return new ValidatorImpl<Date>((value, field) => {
    const trimmed = expectString(value, field).trim();

    if (trimmed.length === 0) {
      fail(field, "Must not be empty.");
    }

    const parsed = new Date(trimmed);

    if (Number.isNaN(parsed.getTime())) {
      fail(field, "Must be a valid date.");
    }

    return parsed;
  });
}

export function booleanValue(): Validator<boolean> {  return new ValidatorImpl<boolean>((value, field) => {
    if (typeof value === "boolean") return value;

    if (value === "true") return true;
    if (value === "false") return false;

    fail(field, "Must be a boolean.");
  });
}

export function enumValue<const T extends readonly string[]>(
  values: T,
): Validator<T[number]> {
  return new ValidatorImpl<T[number]>((value, field) => {
    const parsed = expectString(value, field);

    if (!values.includes(parsed)) {
      fail(field, `Must be one of: ${values.join(", ")}.`);
    }

    return parsed as T[number];
  });
}

/** A required field that may also be explicitly `null`. */
export function nullable<T>(inner: Validator<T>): Validator<T | null> {
  return new ValidatorImpl<T | null>((value, field) => {
    if (value === null) return null;

    return inner.parse(value, field);
  });
}

/** A field that may be omitted entirely. */
export function optional<T>(inner: Validator<T>): Validator<T | undefined> {
  return new ValidatorImpl<T | undefined>((value, field) => {
    if (value === undefined) return undefined;

    return inner.parse(value, field);
  }, true);
}

/* -------------------------------------------------------------------------- */
/* Composite validators                                                        */
/* -------------------------------------------------------------------------- */

export type Shape = Record<string, Validator<unknown>>;

export type ShapeOutput<S extends Shape> = {
  [K in keyof S]: S[K] extends Validator<infer T> ? T : never;
};

export function objectValue<S extends Shape>(
  shape: S,
  options: { partial?: boolean } = {},
): Validator<ShapeOutput<S>> {
  return new ValidatorImpl<ShapeOutput<S>>((value, field) => {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      fail(field, "Must be an object.");
    }

    return parseShape(shape, value, { ...options, prefix: field });
  });
}

export function arrayValue<T>(
  item: Validator<T>,
  options: { min?: number; max?: number } = {},
): Validator<T[]> {
  return new ValidatorImpl<T[]>((value, field) => {
    if (!Array.isArray(value)) {
      fail(field, "Must be an array.");
    }

    if (options.min !== undefined && value.length < options.min) {
      fail(field, `Must contain at least ${options.min} items.`);
    }

    if (options.max !== undefined && value.length > options.max) {
      fail(field, `Must contain at most ${options.max} items.`);
    }

    return value.map((entry, index) => item.parse(entry, `${field}[${index}]`));
  });
}

/* -------------------------------------------------------------------------- */
/* Object parsing                                                             */
/* -------------------------------------------------------------------------- */

export interface ParseShapeOptions {
  /** Only validate the keys that are present in the input. */
  partial?: boolean;
  /** Reject keys that are not part of the shape. */
  rejectUnknown?: boolean;
  /** Builds the error message for an unexpected key. */
  unknownMessage?: (key: string) => string;
  /** Prefix applied to every field name, used for nested objects. */
  prefix?: string;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Validates an object against a shape and returns the parsed values.
 *
 * All failures are collected so the caller receives one complete report.
 */
export function parseShape<S extends Shape>(
  shape: S,
  input: unknown,
  options: ParseShapeOptions = {},
): ShapeOutput<S> {
  const errors: FieldErrors = {};
  const prefix = options.prefix ? `${options.prefix}.` : "";

  if (!isPlainObject(input)) {
    throw new ValidationFailure({
      [prefix ? prefix.replace(/\.$/, "") : "body"]: "Must be a JSON object.",
    });
  }

  const result: Record<string, unknown> = {};

  for (const [key, validator] of Object.entries(shape)) {
    const present = Object.prototype.hasOwnProperty.call(input, key);
    const value = input[key];

    if (!present) {
      if (!options.partial && !validator.optional) {
        errors[`${prefix}${key}`] = "This field is required.";
      }
      continue;
    }

    if (value === undefined) {
      if (!options.partial && !validator.optional) {
        errors[`${prefix}${key}`] = "This field is required.";
      }
      continue;
    }

    try {
      result[key] = validator.parse(value, `${prefix}${key}`);
    } catch (error) {
      if (error instanceof FieldError) {
        errors[`${prefix}${key}`] = error.message;
        continue;
      }

      throw error;
    }
  }

  if (options.rejectUnknown) {
    for (const key of Object.keys(input)) {
      if (Object.prototype.hasOwnProperty.call(shape, key)) continue;

      errors[`${prefix}${key}`] = options.unknownMessage
        ? options.unknownMessage(key)
        : "This field is not allowed.";
    }
  }

  if (Object.keys(errors).length > 0) {
    throw new ValidationFailure(errors);
  }

  return result as ShapeOutput<S>;
}

/**
 * Validates only the keys present in the input. Used for partial updates
 * where absent keys mean "leave unchanged".
 */
export function parsePartialShape<S extends Shape>(
  shape: S,
  input: unknown,
  options: Omit<ParseShapeOptions, "partial"> = {},
): Partial<ShapeOutput<S>> {
  return parseShape(shape, input, { ...options, partial: true }) as Partial<
    ShapeOutput<S>
  >;
}

/** Builds a shape from a plain record of validators. */
export function shape<S extends Shape>(definition: S): S {
  return definition;
}
