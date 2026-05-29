import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { requireHostTripForInvite } from "@/lib/auth/require-host-trip";
import { hostApiError } from "@/lib/host/api-errors";
import { db } from "@/lib/db/client";
import { tripDays } from "@/lib/db/schema";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ inviteCode: string }> },
) {
  const { inviteCode } = await ctx.params;
  try {
    const trip = await requireHostTripForInvite(inviteCode);
    const dayCount = await db
      .select({ id: tripDays.id })
      .from(tripDays)
      .where(eq(tripDays.tripId, trip.id))
      .then((rows) => rows.length);

    const building = dayCount === 0 && trip.publishedVersion === 0;

    return NextResponse.json({
      building,
      dayCount,
      publishedVersion: trip.publishedVersion,
    });
  } catch (err) {
    return hostApiError(err);
  }
}
