import { NextResponse } from "next/server";

export function adminApiError(err: unknown) {
  const message = err instanceof Error ? err.message : "Something went wrong.";
  if (message === "Unauthorized") {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (message === "Forbidden") {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }
  if (message === "Invalid email or password.") {
    return NextResponse.json({ error: message }, { status: 401 });
  }
  console.error("[admin-api]", err);
  return NextResponse.json({ error: message }, { status: 500 });
}
