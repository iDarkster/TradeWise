/**
 * Environment configuration for TradeWise frontend.
 * Reads VITE_API_BASE_URL with safe local development fallback.
 */

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL?.trim() || "http://localhost:5001";

export const IS_PRODUCTION = import.meta.env.PROD;
export const IS_DEVELOPMENT = import.meta.env.DEV;
