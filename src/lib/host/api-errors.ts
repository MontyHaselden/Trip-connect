import { NextResponse } from "next/server";

export function hostApiError(err: unknown, fallback = "Request failed.") {
  const msg = err instanceof Error ? err.message : fallback;
  const status = msg === "Unauthorized" ? 401 : 400;
  return NextResponse.json({ error: msg }, { status });
}
