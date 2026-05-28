import { NextResponse } from "next/server";

import { requireHostTripForInvite } from "@/lib/auth/require-host-trip";
import { hostApiError } from "@/lib/host/api-errors";
import { loadRoster } from "@/lib/host/roster-queries";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ inviteCode: string }> },
) {
  const { inviteCode } = await ctx.params;
  try {
    const trip = await requireHostTripForInvite(inviteCode);
    const roster = await loadRoster(trip.id);
    return NextResponse.json(roster);
  } catch (err) {
    return hostApiError(err);
  }
}
