import { API_BASE_URL } from "../constants/env.js";
import { ApiError } from "./errors.js";
import type { ApiErrorEnvelope, ApiSuccessEnvelope } from "../../types/api.js";

let inMemoryCsrfToken: string | null = null;

export function setCsrfToken(token: string | null): void {
  inMemoryCsrfToken = token;
}

export function getCsrfToken(): string | null {
  return inMemoryCsrfToken;
}

export interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  params?: Record<string, string | number | boolean | undefined>;
}

/**
 * Core HTTP client for TradeWise API.
 * Always sends credentials for HTTP-only cookie session authentication.
 * Automatically injects X-CSRF-Token for state-changing requests when available.
 */
export async function apiRequest<T>(
  endpoint: string,
  options: RequestOptions = {},
): Promise<T> {
  const { body, params, headers: customHeaders, ...fetchOptions } = options;

  const cleanBase = API_BASE_URL.replace(/\/+$/, "");
  const cleanEndpoint = endpoint.replace(/^\/+/, "");
  let url = endpoint.startsWith("http")
    ? endpoint
    : cleanBase.endsWith("/api") && cleanEndpoint.startsWith("api/")
    ? `${cleanBase}/${cleanEndpoint.replace(/^api\//, "")}`
    : `${cleanBase}/${cleanEndpoint}`;

  if (params) {
    const searchParams = new URLSearchParams();
    for (const [key, val] of Object.entries(params)) {
      if (val !== undefined) {
        searchParams.append(key, String(val));
      }
    }
    const queryString = searchParams.toString();
    if (queryString) {
      url += (url.includes("?") ? "&" : "?") + queryString;
    }
  }

  const headers = new Headers(customHeaders);

  const method = (fetchOptions.method || "GET").toUpperCase();

  if (body !== undefined && !(body instanceof FormData) && !(body instanceof Blob)) {
    headers.set("Content-Type", "application/json");
  }

  // Attach CSRF token on state-changing requests if present in memory
  if (["POST", "PUT", "PATCH", "DELETE"].includes(method) && inMemoryCsrfToken) {
    headers.set("X-CSRF-Token", inMemoryCsrfToken);
  }

  const response = await fetch(url, {
    ...fetchOptions,
    method,
    headers,
    credentials: "include", // Required for HTTP-only cookie sessions
    body:
      body !== undefined
        ? body instanceof FormData || body instanceof Blob
          ? body
          : JSON.stringify(body)
        : undefined,
  });

  // Handle 204 No Content
  if (response.status === 204) {
    return undefined as unknown as T;
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    const errorEnvelope = data as ApiErrorEnvelope | null;
    if (errorEnvelope && errorEnvelope.error) {
      throw new ApiError(response.status, errorEnvelope.error);
    }

    throw new ApiError(response.status, {
      code: "HTTP_ERROR",
      message: response.statusText || `Request failed with status ${response.status}`,
    });
  }

  // If response uses the shared envelope { success: true, data }, unwrap it
  const successEnvelope = data as ApiSuccessEnvelope<T> | null;
  if (successEnvelope && successEnvelope.success === true && "data" in successEnvelope) {
    return successEnvelope.data;
  }

  return data as T;
}

export const apiClient = {
  get: <T>(endpoint: string, options?: RequestOptions) =>
    apiRequest<T>(endpoint, { ...options, method: "GET" }),

  post: <T>(endpoint: string, body?: unknown, options?: RequestOptions) =>
    apiRequest<T>(endpoint, { ...options, method: "POST", body }),

  put: <T>(endpoint: string, body?: unknown, options?: RequestOptions) =>
    apiRequest<T>(endpoint, { ...options, method: "PUT", body }),

  patch: <T>(endpoint: string, body?: unknown, options?: RequestOptions) =>
    apiRequest<T>(endpoint, { ...options, method: "PATCH", body }),

  delete: <T>(endpoint: string, options?: RequestOptions) =>
    apiRequest<T>(endpoint, { ...options, method: "DELETE" }),
};
