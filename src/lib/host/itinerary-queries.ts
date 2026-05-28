import { and, asc, eq, max } from "drizzle-orm";

import { db } from "@/lib/db/client";
import {
  groups,
  itineraryItems,
  participants,
  rooms,
  tomorrowPrepItems,
  tripDays,
} from "@/lib/db/schema";

export function normalizeTime(input: string): string {
  const t = input.trim();
  if (/^\d{2}:\d{2}$/.test(t)) return `${t}:00`;
  if (/^\d{2}:\d{2}:\d{2}$/.test(t)) return t;
  throw new Error("Time must be HH:MM or HH:MM:SS");
}

export function isDateInRange(
  dateISO: string,
  startDate: string,
  endDate: string,
): boolean {
  return dateISO >= startDate && dateISO <= endDate;
}

export async function loadItineraryTree(tripId: string) {
  const days = await db
    .select()
    .from(tripDays)
    .where(eq(tripDays.tripId, tripId))
    .orderBy(asc(tripDays.sortOrder));

  const items = await db
    .select()
    .from(itineraryItems)
    .where(eq(itineraryItems.tripId, tripId))
    .orderBy(asc(itineraryItems.tripDayId), asc(itineraryItems.sortOrder));

  const prep = await db
    .select()
    .from(tomorrowPrepItems)
    .where(eq(tomorrowPrepItems.tripId, tripId))
    .orderBy(asc(tomorrowPrepItems.tripDayId), asc(tomorrowPrepItems.sortOrder));

  return {
    days: days.map((d) => ({
      id: d.id,
      date: d.date,
      cityLabel: d.cityLabel,
      summary: d.summary,
      sortOrder: d.sortOrder,
      items: items
        .filter((i) => i.tripDayId === d.id)
        .map((i) => ({
          id: i.id,
          tripDayId: i.tripDayId,
          startTime: i.startTime,
          endTime: i.endTime,
          title: i.title,
          locationName: i.locationName,
          address: i.address,
          mapQuery: i.mapQuery,
          leaveByTime: i.leaveByTime,
          transportNote: i.transportNote,
          bringNote: i.bringNote,
          hostNote: i.hostNote,
          audienceType: i.audienceType,
          audienceId: i.audienceId,
          sortOrder: i.sortOrder,
        })),
      prep: prep
        .filter((p) => p.tripDayId === d.id)
        .map((p) => ({
          id: p.id,
          tripDayId: p.tripDayId,
          text: p.text,
          sortOrder: p.sortOrder,
        })),
    })),
  };
}

export async function getTripDayForTrip(tripId: string, dayId: string) {
  const day = await db
    .select()
    .from(tripDays)
    .where(and(eq(tripDays.id, dayId), eq(tripDays.tripId, tripId)))
    .limit(1)
    .then((rows) => rows[0] ?? null);
  return day;
}

export async function getItemForTrip(tripId: string, itemId: string) {
  const item = await db
    .select()
    .from(itineraryItems)
    .where(and(eq(itineraryItems.id, itemId), eq(itineraryItems.tripId, tripId)))
    .limit(1)
    .then((rows) => rows[0] ?? null);
  return item;
}

export async function getPrepForTrip(tripId: string, prepId: string) {
  const row = await db
    .select()
    .from(tomorrowPrepItems)
    .where(
      and(eq(tomorrowPrepItems.id, prepId), eq(tomorrowPrepItems.tripId, tripId)),
    )
    .limit(1)
    .then((rows) => rows[0] ?? null);
  return row;
}

export async function nextDaySortOrder(tripId: string) {
  const row = await db
    .select({ v: max(tripDays.sortOrder) })
    .from(tripDays)
    .where(eq(tripDays.tripId, tripId))
    .then((rows) => rows[0]);
  return (row?.v ?? 0) + 1;
}

export async function nextItemSortOrder(tripDayId: string) {
  const row = await db
    .select({ v: max(itineraryItems.sortOrder) })
    .from(itineraryItems)
    .where(eq(itineraryItems.tripDayId, tripDayId))
    .then((rows) => rows[0]);
  return (row?.v ?? 0) + 1;
}

export async function nextPrepSortOrder(tripDayId: string) {
  const row = await db
    .select({ v: max(tomorrowPrepItems.sortOrder) })
    .from(tomorrowPrepItems)
    .where(eq(tomorrowPrepItems.tripDayId, tripDayId))
    .then((rows) => rows[0]);
  return (row?.v ?? 0) + 1;
}

export async function validateAudience(
  tripId: string,
  audienceType: "everyone" | "group" | "room" | "participant",
  audienceId: string | null | undefined,
) {
  if (audienceType === "everyone") return null;
  if (!audienceId) throw new Error("Audience is required for this item type.");

  if (audienceType === "group") {
    const g = await db
      .select({ id: groups.id })
      .from(groups)
      .where(and(eq(groups.id, audienceId), eq(groups.tripId, tripId)))
      .limit(1)
      .then((rows) => rows[0]);
    if (!g) throw new Error("Invalid group for audience.");
    return audienceId;
  }

  if (audienceType === "room") {
    const r = await db
      .select({ id: rooms.id })
      .from(rooms)
      .where(and(eq(rooms.id, audienceId), eq(rooms.tripId, tripId)))
      .limit(1)
      .then((rows) => rows[0]);
    if (!r) throw new Error("Invalid room for audience.");
    return audienceId;
  }

  if (audienceType === "participant") {
    const p = await db
      .select({ id: participants.id })
      .from(participants)
      .where(and(eq(participants.id, audienceId), eq(participants.tripId, tripId)))
      .limit(1)
      .then((rows) => rows[0]);
    if (!p) throw new Error("Invalid participant for audience.");
    return audienceId;
  }

  throw new Error("Invalid audience type.");
}

export function eachDateInclusive(start: string, end: string): string[] {
  const out: string[] = [];
  const cur = new Date(`${start}T12:00:00Z`);
  const last = new Date(`${end}T12:00:00Z`);
  while (cur <= last) {
    out.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}
