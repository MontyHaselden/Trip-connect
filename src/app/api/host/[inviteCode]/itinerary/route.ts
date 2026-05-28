import { NextResponse } from "next/server";

import { requireHostTripForInvite } from "@/lib/auth/require-host-trip";
import { hostApiError } from "@/lib/host/api-errors";
import { loadItineraryTree } from "@/lib/host/itinerary-queries";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ inviteCode: string }> },
) {
  const { inviteCode } = await ctx.params;
  try {
    const trip = await requireHostTripForInvite(inviteCode);
    const tree = await loadItineraryTree(trip.id);
    return NextResponse.json(tree);
  } catch (err) {
    return hostApiError(err);
  }
}
