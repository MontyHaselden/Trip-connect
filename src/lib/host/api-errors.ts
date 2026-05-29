import { NextResponse } from "next/server";

export function hostApiError(err: unknown, fallback = "Request failed.") {
  const msg = sanitizeHostApiErrorMessage(collectErrorText(err), fallback);
  const status =
    msg === "Unauthorized" ? 401 : msg === "Forbidden" ? 403 : 400;
  return NextResponse.json({ error: msg }, { status });
}

function collectErrorText(err: unknown): string {
  if (!(err instanceof Error)) return String(err ?? "");

  const parts: string[] = [];
  let current: unknown = err;
  while (current instanceof Error) {
    if (current.message?.trim()) parts.push(current.message.trim());
    current = current.cause;
  }
  return parts.join(" | ");
}

function sanitizeHostApiErrorMessage(raw: string, fallback: string) {
  const msg = raw?.trim?.() ? raw.trim() : fallback;

  if (/host_accounts_email_unique/i.test(msg)) {
    return "An account already exists with that email. Try logging in instead.";
  }
  if (/host_accounts_phone_e164_unique/i.test(msg)) {
    return "An account already exists with that phone number. Try logging in instead.";
  }

  // Common Postgres unique constraint violation (sometimes wrapped in Drizzle "Failed query: ...").
  if (/duplicate key value violates unique constraint/i.test(msg)) {
    return "An account already exists with that email or phone number. Try logging in instead.";
  }

  // Don't leak SQL or internal query details to end users.
  if (/failed query:/i.test(msg)) return fallback;
  if (/\binsert into\b|\bselect\b|\bupdate\b|\bdelete\b/i.test(msg)) return fallback;

  return msg.split(" | ")[0] ?? fallback;
}
