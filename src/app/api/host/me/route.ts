import { NextResponse } from "next/server";

import { getHostSession } from "@/lib/auth/host-session";

export async function GET() {
  const session = await getHostSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({
    hostId: session.hostId,
    activeTripId: session.activeTripId,
  });
}

