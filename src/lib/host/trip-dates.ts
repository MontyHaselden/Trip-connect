import { eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { tripDays, trips } from "@/lib/db/schema";
import { TRIP_DATES_UNSET, tripDatesAreUnset } from "@/lib/host/trip-date-display";

export { TRIP_DATES_UNSET, tripDatesAreUnset };

export function unsetTripDateRange() {
  return { startDate: TRIP_DATES_UNSET, endDate: TRIP_DATES_UNSET };
}

/** Set trip start/end from the earliest and latest scheduled day dates. */
export async function syncTripDatesFromDays(tripId: string) {
  const days = await db
    .select({ date: tripDays.date })
    .from(tripDays)
    .where(eq(tripDays.tripId, tripId));

  if (!days.length) return null;

  const sorted = days.map((d) => d.date).sort();
  const startDate = sorted[0]!;
  const endDate = sorted[sorted.length - 1]!;

  await db
    .update(trips)
    .set({ startDate, endDate, updatedAt: new Date() })
    .where(eq(trips.id, tripId));

  return { startDate, endDate };
}
