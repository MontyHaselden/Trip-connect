import { NextResponse } from "next/server";

import { clearHostSessionCookie } from "@/lib/auth/host-session";

export async function POST() {
  await clearHostSessionCookie();
  return NextResponse.json({ ok: true });
}
