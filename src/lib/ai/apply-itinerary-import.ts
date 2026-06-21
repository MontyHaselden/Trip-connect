import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { itineraryItems, tripDays } from "@/lib/db/schema";
import type { ItineraryImportResult } from "@/lib/ai/itinerary-import";
import type { z } from "zod";

import type { ImportDaySchema, ImportItemSchema } from "@/lib/ai/itinerary-import-schemas";
import { isAccommodationCheckItemTitle } from "@/lib/host/import/reconcile-accommodation-stays";
import {
  nextDaySortOrder,
  nextItemSortOrder,
} from "@/lib/host/itinerary-queries";
import { syncTripDatesFromDays } from "@/lib/host/trip-dates";
import { toDbBookingStatus } from "@/lib/host/wizard/db-enums";
import { assertValidIsoDate } from "@/lib/utils/iso-date";
import { normalizeStoredTime } from "@/lib/utils/ai-time";

type ImportDay = z.infer<typeof ImportDaySchema>;
type ImportItem = z.infer<typeof ImportItemSchema>;

export async function ensureTripDay(
  tripId: string,
  day: Pick<ImportDay, "date" | "cityLabel" | "summary">,
) {
  assertValidIsoDate(day.date, "trip day date");
  const existing = await db
    .select()
    .from(tripDays)
    .where(and(eq(tripDays.tripId, tripId), eq(tripDays.date, day.date)))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (existing) {
    await db
      .update(tripDays)
      .set({
        cityLabel: day.cityLabel,
        summary: day.summary ?? null,
      })
      .where(eq(tripDays.id, existing.id));
    return { dayId: existing.id, created: false, updated: true };
  }

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

  if (!created) {
    throw new Error(`Could not create day ${day.date}.`);
  }

  return { dayId: created.id, created: true, updated: false };
}

export async function applyItineraryItem(
  tripId: string,
  dayId: string,
  item: ImportItem,
) {
  if (isAccommodationCheckItemTitle(item.title)) {
    return null;
  }

  const sortOrder = await nextItemSortOrder(dayId);
  const [created] = await db
    .insert(itineraryItems)
    .values({
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
      category: item.category ?? "other",
      sortOrder,
      wizardSource: "activity",
      bookingStatus: toDbBookingStatus("not_booked"),
      isTimeTbc: false,
      isLocationTbc: !(item.locationName?.trim() || item.address?.trim()),
    })
    .returning({ id: itineraryItems.id });

  if (!created) {
    throw new Error("Could not create itinerary item.");
  }

  return created.id;
}

export async function applyItineraryImport(
  tripId: string,
  data: ItineraryImportResult,
) {
  let daysCreated = 0;
  let daysUpdated = 0;
  let itemsCreated = 0;

  for (const day of data.days) {
    const ensured = await ensureTripDay(tripId, day);
    if (ensured.created) daysCreated++;
    if (ensured.updated) daysUpdated++;

    for (const item of day.items) {
      await applyItineraryItem(tripId, ensured.dayId, item);
      itemsCreated++;
    }
  }

  await syncTripDatesFromDays(tripId);

  return { daysCreated, daysUpdated, itemsCreated };
}
