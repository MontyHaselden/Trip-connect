import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { itineraryItems, tripDays } from "@/lib/db/schema";
import type { ItineraryImportResult } from "@/lib/ai/itinerary-import";
import {
  nextDaySortOrder,
  nextItemSortOrder,
} from "@/lib/host/itinerary-queries";
import { normalizeStoredTime } from "@/lib/utils/ai-time";

export async function applyItineraryImport(
  tripId: string,
  data: ItineraryImportResult,
) {
  let daysCreated = 0;
  let daysUpdated = 0;
  let itemsCreated = 0;

  for (const day of data.days) {
    const existing = await db
      .select()
      .from(tripDays)
      .where(and(eq(tripDays.tripId, tripId), eq(tripDays.date, day.date)))
      .limit(1)
      .then((rows) => rows[0] ?? null);

    let dayId: string;
    if (existing) {
      await db
        .update(tripDays)
        .set({
          cityLabel: day.cityLabel,
          summary: day.summary ?? null,
        })
        .where(eq(tripDays.id, existing.id));
      dayId = existing.id;
      daysUpdated++;
    } else {
      const sortOrder = await nextDaySortOrder(tripId);
      const [created] = await db
        .insert(tripDays)
        .values({
          tripId,
          date: day.date,
          cityLabel: day.cityLabel,
          summary: day.summary ?? null,
          sortOrder,
        })
        .returning();
      if (!created) continue;
      dayId = created.id;
      daysCreated++;
    }

    for (const item of day.items) {
      const sortOrder = await nextItemSortOrder(dayId);
      await db.insert(itineraryItems).values({
        tripId,
        tripDayId: dayId,
        startTime: normalizeStoredTime(item.startTime),
        endTime: item.endTime ? normalizeStoredTime(item.endTime) : null,
        title: item.title,
        locationName: item.locationName ?? null,
        address: item.address ?? null,
        mapQuery: null,
        leaveByTime: item.leaveByTime ? normalizeStoredTime(item.leaveByTime) : null,
        transportNote: item.transportNote ?? null,
        bringNote: item.bringNote ?? null,
        hostNote: null,
        audienceType: "everyone",
        audienceId: null,
        sortOrder,
      });
      itemsCreated++;
    }
  }

  return { daysCreated, daysUpdated, itemsCreated };
}
