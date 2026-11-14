/**
 * Best-effort, non-identifying description of a client from its User-Agent
 * header. Used only to help a user recognise their own sessions.
 *
 * This is intentionally a coarse label. No device fingerprinting, no
 * IP addresses and no other identifying signals are collected.
 */

export interface ClientDescription {
  browser: string;
  platform: string;
}

/**
 * Extracts a coarse browser/platform label from a User-Agent string.
 *
 * Unrecognised or missing values fall back to neutral labels.
 */
export function describeClient(userAgent: string | null | undefined): ClientDescription {
  const agent = userAgent ?? "";

  let browser = "Unknown browser";

  if (/\bEdg[A-Z]?\//i.test(agent)) {
    browser = "Edge";
  } else if (/\bOPR\/|\bOpera\b/i.test(agent)) {
    browser = "Opera";
  } else if (/\bFirefox\//i.test(agent)) {
    browser = "Firefox";
  } else if (/\bChrome\//i.test(agent)) {
    browser = "Chrome";
  } else if (/\bSafari\//i.test(agent)) {
    browser = "Safari";
  } else if (/\bcurl\/|\bwget\//i.test(agent)) {
    browser = "Command-line client";
  }

  let platform = "Unknown platform";

  if (/\bWindows\b/i.test(agent)) {
    platform = "Windows";
  } else if (/\bAndroid\b/i.test(agent)) {
    platform = "Android";
  } else if (/\biPhone\b|\biPad\b|\biPod\b/i.test(agent)) {
    platform = "iOS";
  } else if (/\bMac OS X\b|\bMacintosh\b/i.test(agent)) {
    platform = "macOS";
  } else if (/\bLinux\b/i.test(agent)) {
    platform = "Linux";
  }

  return { browser, platform };
}

/** Renders a single human-readable session label. */
export function formatClientLabel(userAgent: string | null | undefined): string {
  const { browser, platform } = describeClient(userAgent);

  if (browser === "Unknown browser" && platform === "Unknown platform") {
    return "Unknown client";
  }

  if (platform === "Unknown platform") return browser;

  return `${browser} on ${platform}`;
}

/**
 * Normalises a User-Agent header for storage.
 *
 * The stored value is truncated to the column limit and never contains
 * anything beyond the header itself.
 */
export function normaliseUserAgent(userAgent: string | null | undefined): string | null {
  if (!userAgent) return null;

  const trimmed = userAgent.trim();

  if (trimmed.length === 0) return null;

  return trimmed.length > 512 ? trimmed.slice(0, 512) : trimmed;
}
