import { NextResponse } from "next/server";

export function hostApiError(err: unknown, fallback = "Request failed.") {
  const raw = err instanceof Error ? err.message : fallback;
  const msg = sanitizeHostApiErrorMessage(raw, fallback);
  const status = msg === "Unauthorized" ? 401 : 400;
  return NextResponse.json({ error: msg }, { status });
}

function sanitizeHostApiErrorMessage(raw: string, fallback: string) {
  const msg = raw?.trim?.() ? raw.trim() : fallback;

  // Common Postgres unique constraint violation (sometimes wrapped in Drizzle "Failed query: ...").
  if (/duplicate key value violates unique constraint/i.test(msg)) {
    return "An account already exists with that email or phone number.";
  }

  // Don't leak SQL or internal query details to end users.
  if (/failed query:/i.test(msg)) return fallback;
  if (/\binsert into\b|\bselect\b|\bupdate\b|\bdelete\b/i.test(msg)) return fallback;

  return msg;
}
