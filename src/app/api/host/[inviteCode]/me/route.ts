import { NextResponse } from "next/server";

import { requireHostTripForInvite } from "@/lib/auth/require-host-trip";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ inviteCode: string }> },
) {
  const { inviteCode } = await ctx.params;

  try {
    const trip = await requireHostTripForInvite(inviteCode);
    return NextResponse.json({
      tripId: trip.id,
      inviteCode: trip.inviteCode,
      publishedVersion: trip.publishedVersion,
    });
  } catch {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
}
