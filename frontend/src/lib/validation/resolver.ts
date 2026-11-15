import type { z } from "zod";
import type { FieldValues, Resolver } from "react-hook-form";

/**
 * Lightweight Zod resolver for React Hook Form.
 * Integrates Zod schemas with React Hook Form without external resolver packages.
 */
export function zodResolver<T extends FieldValues>(
  schema: z.ZodType<T, any, any>, // eslint-disable-line @typescript-eslint/no-explicit-any
): Resolver<T> {
  return async (values) => {
    const result = schema.safeParse(values);

    if (result.success) {
      return {
        values: result.data,
        errors: {},
      };
    }

    const errors: Record<string, { type: string; message: string }> = {};

    for (const issue of result.error.issues) {
      const path = issue.path.join(".");
      if (!errors[path]) {
        errors[path] = {
          type: issue.code,
          message: issue.message,
        };
      }
    }

    return {
      values: {} as T,
      errors: errors as any, // eslint-disable-line @typescript-eslint/no-explicit-any
    };
  };
}
