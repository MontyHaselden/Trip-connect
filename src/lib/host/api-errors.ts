import { NextResponse } from "next/server";

import { BillingAccessError } from "@/lib/billing/access";

export function hostApiError(err: unknown, fallback = "Request failed.") {
  if (err instanceof BillingAccessError) {
    return NextResponse.json({ error: err.message, code: err.code }, { status: 402 });
  }
  const msg = sanitizeHostApiErrorMessage(collectErrorText(err), fallback);
  const status =
    msg === "Unauthorized" ? 401 : msg === "Forbidden" ? 403 : 400;
  return NextResponse.json({ error: msg }, { status });
}

function collectErrorText(err: unknown): string {
  if (!(err instanceof Error)) return String(err ?? "");

  if (err.name === "ZodError" && "issues" in err && Array.isArray(err.issues)) {
    const first = err.issues[0] as { path?: unknown[]; message?: string } | undefined;
    if (first?.message) {
      const path =
        Array.isArray(first.path) && first.path.length
          ? first.path.map(String).join(".")
          : "value";
      return `Invalid ${path}: ${first.message}`;
    }
  }

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
    if (/cost_allocation_overrides/i.test(msg)) {
      return "Could not save per-person prices for this row. Try again.";
    }
    if (/group_day_places/i.test(msg)) {
      return "Could not save calendar paint for that day. Refresh and try again.";
    }
    return "That value is already in use.";
  }

  if (/group_day_places_group_id_groups_id_fk/i.test(msg)) {
    return "Personal group is not ready yet. Refresh the page and try again.";
  }

  if (/column "[^"]+" does not exist/i.test(msg)) {
    return "Database schema is out of date. Run npm run db:migrate against your production database.";
  }
  if (/type "public\.[^"]+" does not exist/i.test(msg)) {
    return "Database schema is out of date. Run npm run db:migrate against your production database.";
  }

  // Don't leak SQL or internal query details to end users.
  if (/failed query:/i.test(msg)) return fallback;
  if (/\binsert into\b|\bselect\b|\bupdate\b|\bdelete\b/i.test(msg)) return fallback;

  return msg.split(" | ")[0] ?? fallback;
}
