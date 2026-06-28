import { and, asc, eq, isNull, or } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { itineraryItems, tripDays } from "@/lib/db/schema";
import { nextItemSortOrder } from "@/lib/host/itinerary-queries";
import { toDbBookingStatus } from "@/lib/host/wizard/db-enums";
import type { ActivityDraft } from "@/lib/host/wizard/types";
import { normalizeGraphActivities } from "./merge-graph-activities";
import { normalizeStoredTime } from "@/lib/utils/ai-time";

function defaultTime(t: string | null, fallback: string): string {
  if (!t?.trim()) return fallback;
  try {
    return normalizeStoredTime(t);
  } catch {
    return fallback;
  }
}

function rowToActivity(
  row: {
    id: string;
    startTime: string;
    endTime: string | null;
    title: string;
    locationName: string | null;
    address: string | null;
    googlePlaceId: string | null;
    latitude: string | null;
    longitude: string | null;
    leaveByTime: string | null;
    transportNote: string | null;
    bringNote: string | null;
    hostNote: string | null;
    audienceType: ActivityDraft["audienceType"];
    audienceId: string | null;
    originGroupId: string | null;
    category: ActivityDraft["category"] | null;
    bookingStatus: string | null;
    isTimeTbc: boolean;
    isLocationTbc: boolean;
  },
  date: string,
): ActivityDraft {
  const lat = row.latitude != null ? Number(row.latitude) : null;
  const lng = row.longitude != null ? Number(row.longitude) : null;
  return {
    id: row.id,
    title: row.title,
    date,
    endDate: null,
    startTime: row.isTimeTbc ? null : row.startTime.slice(0, 5),
    endTime: row.endTime ? row.endTime.slice(0, 5) : null,
    isTimeTbc: row.isTimeTbc,
    category: row.category ?? "other",
    locationName: row.locationName,
    address: row.address,
    googlePlaceId: row.googlePlaceId,
    latitude: Number.isFinite(lat) ? lat : null,
    longitude: Number.isFinite(lng) ? lng : null,
    isLocationTbc: row.isLocationTbc,
    transportNote: row.transportNote,
    leaveByTime: row.leaveByTime ? row.leaveByTime.slice(0, 5) : null,
    bringNote: row.bringNote,
    description: row.hostNote,
    audienceType: row.audienceType,
    audienceId: row.audienceId,
    originGroupId: row.originGroupId,
    bookingStatus:
      row.bookingStatus === "booked"
        ? "booked"
        : row.bookingStatus === "flexible"
          ? "flexible"
          : row.bookingStatus === "placeholder"
            ? "placeholder"
            : "not_booked",
  };
}

export async function loadActivitiesForTrip(tripId: string): Promise<ActivityDraft[]> {
  const dayRows = await db
    .select({ id: tripDays.id, date: tripDays.date })
    .from(tripDays)
    .where(eq(tripDays.tripId, tripId));

  const dateByDayId = new Map(dayRows.map((d) => [d.id, d.date]));

  const itemRows = await db
    .select()
    .from(itineraryItems)
    .where(
      and(
        eq(itineraryItems.tripId, tripId),
        or(eq(itineraryItems.wizardSource, "activity"), isNull(itineraryItems.wizardSource)),
      ),
    )
    .orderBy(asc(itineraryItems.sortOrder));

  return itemRows
    .map((row) => {
      const date = dateByDayId.get(row.tripDayId);
      if (!date) return null;
      return rowToActivity(row, date);
    })
    .filter((a): a is ActivityDraft => a !== null);
}

export async function syncActivitiesForTrip(
  tripId: string,
  activities: ActivityDraft[],
): Promise<void> {
  const normalized = normalizeGraphActivities(activities);
  const dayRows = await db
    .select({ id: tripDays.id, date: tripDays.date })
    .from(tripDays)
    .where(eq(tripDays.tripId, tripId));

  const dayIdByDate = new Map(dayRows.map((d) => [d.date, d.id]));

  await db
    .delete(itineraryItems)
    .where(
      and(eq(itineraryItems.tripId, tripId), eq(itineraryItems.wizardSource, "activity")),
    );

  for (const act of normalized) {
    const dayId = dayIdByDate.get(act.date);
    if (!dayId) continue;
    const sortOrder = await nextItemSortOrder(dayId);
    await db.insert(itineraryItems).values({
      id: act.id,
      tripId,
      tripDayId: dayId,
      startTime: act.isTimeTbc ? "09:00:00" : defaultTime(act.startTime, "09:00:00"),
      endTime: act.endTime ? defaultTime(act.endTime, "10:00:00") : null,
      title: act.title,
      locationName: act.isLocationTbc ? null : act.locationName,
      address: act.address,
      googlePlaceId: act.googlePlaceId ?? null,
      latitude: act.latitude != null ? String(act.latitude) : null,
      longitude: act.longitude != null ? String(act.longitude) : null,
      mapQuery: null,
      leaveByTime: act.leaveByTime ? defaultTime(act.leaveByTime, "08:00:00") : null,
      transportNote: act.transportNote,
      bringNote: act.bringNote,
      hostNote: act.description,
      audienceType: act.audienceType,
      audienceId: act.audienceId,
      originGroupId: act.originGroupId ?? null,
      category: act.category,
      sortOrder,
      bookingStatus: toDbBookingStatus(act.bookingStatus),
      wizardSource: "activity",
      isTimeTbc: act.isTimeTbc,
      isLocationTbc: act.isLocationTbc,
    });
  }
}
