import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { itineraryItems, tripDays } from "@/lib/db/schema";
import { nextDaySortOrder } from "@/lib/host/itinerary-queries";
import { normalizeStoredTime } from "@/lib/utils/ai-time";
import { ACTIVITY_CATEGORIES, type ActivityCategory } from "@/types/activity-category";

function categoryFromPayload(value: unknown): ActivityCategory | null {
  return ACTIVITY_CATEGORIES.includes(value as ActivityCategory)
    ? (value as ActivityCategory)
    : null;
}

export async function getTripDayIdForDate(tripId: string, date: string) {
  return db
    .select({ id: tripDays.id })
    .from(tripDays)
    .where(and(eq(tripDays.tripId, tripId), eq(tripDays.date, date)))
    .limit(1)
    .then((rows) => rows[0]?.id ?? null);
}

export async function ensureTripDayId(
  tripId: string,
  date: string,
  cityLabel = "Day",
) {
  const existingId = await getTripDayIdForDate(tripId, date);
  if (existingId) return existingId;

  const sortOrder = await nextDaySortOrder(tripId);
  const [created] = await db
    .insert(tripDays)
    .values({
      tripId,
      date,
      cityLabel,
      sortOrder,
    })
    .returning({ id: tripDays.id });

  return created?.id ?? null;
}

export async function resolveItemDayId(
  tripId: string,
  payload: Record<string, unknown>,
) {
  const date =
    typeof payload.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(payload.date)
      ? payload.date
      : null;
  if (date) {
    const cityLabel =
      typeof payload.cityLabel === "string" ? payload.cityLabel : "Day";
    return ensureTripDayId(tripId, date, cityLabel);
  }

  return db
    .select({ id: tripDays.id })
    .from(tripDays)
    .where(eq(tripDays.tripId, tripId))
    .orderBy(tripDays.sortOrder)
    .limit(1)
    .then((rows) => rows[0]?.id ?? null);
}

export async function findItemsForUpdate(
  tripId: string,
  titleMatch: string,
  date?: string | null,
) {
  const items = await db
    .select({
      id: itineraryItems.id,
      title: itineraryItems.title,
      tripDayId: itineraryItems.tripDayId,
    })
    .from(itineraryItems)
    .where(eq(itineraryItems.tripId, tripId));

  let dayId: string | null = null;
  if (date) {
    dayId = await getTripDayIdForDate(tripId, date);
    if (!dayId) return [];
  }

  return items.filter((item) => {
    if (dayId && item.tripDayId !== dayId) return false;
    return item.title.toLowerCase().includes(titleMatch);
  });
}

export function itemValuesFromPayload(
  tripId: string,
  dayId: string,
  sortOrder: number,
  payload: Record<string, unknown>,
) {
  return {
    tripId,
    tripDayId: dayId,
    startTime: normalizeStoredTime(String(payload.startTime ?? "09:00:00")),
    endTime:
      typeof payload.endTime === "string" && payload.endTime
        ? normalizeStoredTime(payload.endTime)
        : null,
    title: String(payload.title ?? "Activity"),
    locationName:
      typeof payload.locationName === "string" ? payload.locationName : null,
    address: typeof payload.address === "string" ? payload.address : null,
    mapQuery: typeof payload.mapQuery === "string" ? payload.mapQuery : null,
    leaveByTime:
      typeof payload.leaveByTime === "string" && payload.leaveByTime
        ? normalizeStoredTime(payload.leaveByTime)
        : null,
    transportNote:
      typeof payload.transportNote === "string" ? payload.transportNote : null,
    bringNote: typeof payload.bringNote === "string" ? payload.bringNote : null,
    hostNote: typeof payload.hostNote === "string" ? payload.hostNote : null,
    audienceType: "everyone" as const,
    audienceId: null,
    category: categoryFromPayload(payload.category),
    sortOrder,
  };
}
