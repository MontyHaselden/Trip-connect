import { DateTime } from "luxon";
import { eq, inArray, sql } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { itineraryItems, tripDays } from "@/lib/db/schema";
import { tripDatesAreUnset } from "@/lib/host/trip-date-display";

export type TripDeleteInput = {
  id: string;
  startDate: string;
  endDate: string;
  timezone: string;
  publishedVersion: number;
};

export type TripDeleteStatus = {
  canDelete: boolean;
  reason: string | null;
  isCompleted: boolean;
  isFullyBuilt: boolean;
};

export type ItineraryBuildStats = {
  dayCount: number;
  itemCount: number;
  allDaysHaveItems: boolean;
};

export function isTripCompleted(trip: Pick<TripDeleteInput, "endDate" | "timezone" | "startDate">) {
  if (tripDatesAreUnset(trip.startDate, trip.endDate)) return false;
  const today = DateTime.now().setZone(trip.timezone).toISODate();
  if (!today) return false;
  return trip.endDate < today;
}

export function isTripFullyBuilt(
  trip: Pick<TripDeleteInput, "startDate" | "endDate" | "publishedVersion">,
  stats: ItineraryBuildStats,
) {
  if (trip.publishedVersion > 0) return true;
  if (tripDatesAreUnset(trip.startDate, trip.endDate)) return false;
  if (stats.dayCount === 0 || stats.itemCount === 0) return false;
  return stats.allDaysHaveItems;
}

export function resolveTripDeleteStatus(
  trip: TripDeleteInput,
  stats: ItineraryBuildStats,
): TripDeleteStatus {
  const completed = isTripCompleted(trip);
  const fullyBuilt = isTripFullyBuilt(trip, stats);

  if (completed) {
    return {
      canDelete: false,
      reason: "Completed trips cannot be deleted.",
      isCompleted: true,
      isFullyBuilt: fullyBuilt,
    };
  }

  if (fullyBuilt) {
    return {
      canDelete: false,
      reason: trip.publishedVersion > 0
        ? "Published trips cannot be deleted."
        : "Fully built trips cannot be deleted.",
      isCompleted: false,
      isFullyBuilt: true,
    };
  }

  return {
    canDelete: true,
    reason: null,
    isCompleted: false,
    isFullyBuilt: false,
  };
}

export async function loadItineraryBuildStats(tripId: string): Promise<ItineraryBuildStats> {
  const days = await db
    .select({ id: tripDays.id })
    .from(tripDays)
    .where(eq(tripDays.tripId, tripId));

  if (!days.length) {
    return { dayCount: 0, itemCount: 0, allDaysHaveItems: false };
  }

  const items = await db
    .select({ tripDayId: itineraryItems.tripDayId })
    .from(itineraryItems)
    .where(eq(itineraryItems.tripId, tripId));

  const daysWithItems = new Set(items.map((row) => row.tripDayId));
  return {
    dayCount: days.length,
    itemCount: items.length,
    allDaysHaveItems: days.every((day) => daysWithItems.has(day.id)),
  };
}

export async function loadItineraryBuildStatsForTrips(
  tripIds: string[],
): Promise<Map<string, ItineraryBuildStats>> {
  const result = new Map<string, ItineraryBuildStats>();
  if (!tripIds.length) return result;

  for (const tripId of tripIds) {
    result.set(tripId, { dayCount: 0, itemCount: 0, allDaysHaveItems: false });
  }

  const dayRows = await db
    .select({ tripId: tripDays.tripId, id: tripDays.id })
    .from(tripDays)
    .where(inArray(tripDays.tripId, tripIds));

  const daysByTrip = new Map<string, string[]>();
  for (const row of dayRows) {
    const list = daysByTrip.get(row.tripId) ?? [];
    list.push(row.id);
    daysByTrip.set(row.tripId, list);
  }

  const itemRows = await db
    .select({
      tripId: itineraryItems.tripId,
      tripDayId: itineraryItems.tripDayId,
      count: sql<number>`count(*)::int`,
    })
    .from(itineraryItems)
    .where(inArray(itineraryItems.tripId, tripIds))
    .groupBy(itineraryItems.tripId, itineraryItems.tripDayId);

  const itemsByTripDay = new Map<string, Set<string>>();
  const itemCountByTrip = new Map<string, number>();

  for (const row of itemRows) {
    const daySet = itemsByTripDay.get(row.tripId) ?? new Set<string>();
    daySet.add(row.tripDayId);
    itemsByTripDay.set(row.tripId, daySet);
    itemCountByTrip.set(row.tripId, (itemCountByTrip.get(row.tripId) ?? 0) + row.count);
  }

  for (const tripId of tripIds) {
    const dayIds = daysByTrip.get(tripId) ?? [];
    const daysWithItems = itemsByTripDay.get(tripId) ?? new Set<string>();
    result.set(tripId, {
      dayCount: dayIds.length,
      itemCount: itemCountByTrip.get(tripId) ?? 0,
      allDaysHaveItems:
        dayIds.length > 0 && dayIds.every((dayId) => daysWithItems.has(dayId)),
    });
  }

  return result;
}

export async function getTripDeleteStatus(trip: TripDeleteInput): Promise<TripDeleteStatus> {
  const stats = await loadItineraryBuildStats(trip.id);
  return resolveTripDeleteStatus(trip, stats);
}
