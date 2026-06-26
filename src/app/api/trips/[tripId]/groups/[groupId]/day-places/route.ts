import { NextResponse } from "next/server";
import { and, asc, eq, gte, lte } from "drizzle-orm";

import { requireHostSessionHostId } from "@/lib/auth/host-session";
import { db } from "@/lib/db/client";
import { groupDayPlaces, trips } from "@/lib/db/schema";
import { hostApiError } from "@/lib/host/api-errors";
import { getTripByIdForHost } from "@/lib/host/get-trip-by-id";
import { gridBoundsForTripLoad } from "@/lib/trip-engine/grid-bounds-for-load";
import type { DayPlaceDraft } from "@/lib/host/wizard/types";

function rowToDayPlace(row: {
  date: string;
  primaryCity: string;
  secondaryCity: string | null;
  primaryShare: string | number;
  dayType: string | null;
}): DayPlaceDraft {
  return {
    date: row.date,
    primaryCity: row.primaryCity,
    secondaryCity: row.secondaryCity,
    primaryShare: Number(row.primaryShare),
    dayType: (row.dayType ?? "trip") as DayPlaceDraft["dayType"],
    includeBuffer: false,
  };
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ tripId: string; groupId: string }> },
) {
  const { tripId, groupId } = await ctx.params;
  try {
    const hostId = await requireHostSessionHostId();
    const trip = await getTripByIdForHost(hostId, tripId);
    if (!trip) return NextResponse.json({ error: "Trip not found." }, { status: 404 });

    const tripRow = await db
      .select({
        startDate: trips.startDate,
        endDate: trips.endDate,
        timezone: trips.timezone,
      })
      .from(trips)
      .where(eq(trips.id, tripId))
      .limit(1)
      .then((rows) => rows[0] ?? null);
    if (!tripRow) return NextResponse.json({ error: "Trip not found." }, { status: 404 });

    const { gridStart, gridEnd } = gridBoundsForTripLoad(tripRow);
    const rows = await db
      .select()
      .from(groupDayPlaces)
      .where(
        and(
          eq(groupDayPlaces.tripId, tripId),
          eq(groupDayPlaces.groupId, groupId),
          gte(groupDayPlaces.date, gridStart),
          lte(groupDayPlaces.date, gridEnd),
        ),
      )
      .orderBy(asc(groupDayPlaces.date));

    const byDate = new Map<string, DayPlaceDraft>();
    for (const row of rows) {
      byDate.set(row.date, rowToDayPlace(row));
    }
    const dayPlaces = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));

    return NextResponse.json({ groupId, dayPlaces });
  } catch (err) {
    return hostApiError(err);
  }
}
