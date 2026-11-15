import type { AuthContext } from "../services/session.service.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Present when the request was authenticated by a valid session. */
      auth?: AuthContext;
      /** Parsed and validated request body. */
      validatedBody?: unknown;
      /** Parsed and validated query string. */
      validatedQuery?: unknown;
      /** Parsed and validated path parameters. */
      validatedParams?: unknown;
    }
  }
}

export {};
