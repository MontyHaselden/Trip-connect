import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { tripDays } from "@/lib/db/schema";
import { requireHostTripForInvite } from "@/lib/auth/require-host-trip";
import { hostApiError } from "@/lib/host/api-errors";
import { eachDateInclusive, nextDaySortOrder } from "@/lib/host/itinerary-queries";
import { maybeAutoPublish } from "@/lib/publish/maybe-auto-publish";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ inviteCode: string }> },
) {
  const { inviteCode } = await ctx.params;
  try {
    const trip = await requireHostTripForInvite(inviteCode);

    const existing = await db
      .select({ date: tripDays.date })
      .from(tripDays)
      .where(eq(tripDays.tripId, trip.id));

    const existingSet = new Set(existing.map((d) => d.date));
    const dates = eachDateInclusive(trip.startDate, trip.endDate);
    let created = 0;
    let sortOrder = await nextDaySortOrder(trip.id);

    for (const date of dates) {
      if (existingSet.has(date)) continue;
      await db.insert(tripDays).values({
        tripId: trip.id,
        date,
        cityLabel: "City",
        sortOrder: sortOrder++,
      });
      created++;
    }

    await maybeAutoPublish(trip.id);
    return NextResponse.json({ created });
  } catch (err) {
    return hostApiError(err);
  }
}
