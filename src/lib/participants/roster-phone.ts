import { randomUUID } from "node:crypto";

/** Internal placeholder phones for roster slots before a student joins. */
export const PLACEHOLDER_PHONE_PREFIX = "+00000000";

export function isPlaceholderPhone(phoneE164: string): boolean {
  return phoneE164.startsWith(PLACEHOLDER_PHONE_PREFIX);
}

/** Unique placeholder without a DB round-trip (collision risk is negligible). */
export function generatePlaceholderPhone(): string {
  return `${PLACEHOLDER_PHONE_PREFIX}${randomUUID().replace(/-/g, "").slice(0, 12)}`;
}
