import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import {
  itineraryItems,
  tripDayReminders,
  tripDays,
  trips,
} from "@/lib/db/schema";
import { applyTripLocationState } from "@/lib/host/locations/apply-location-state";
import { inferTimezoneFromWizardBasics } from "@/lib/geo/resolve-timezone";
import { nextDaySortOrder, nextItemSortOrder } from "@/lib/host/itinerary-queries";
import { normalizeStoredTime } from "@/lib/utils/ai-time";

import { toDbBookingStatus, toDbTransportType } from "./db-enums";
import type { DayPlaceDraft, TripWizardDraft } from "./types";

function addDays(iso: string, delta: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

function defaultTime(t: string | null, fallback: string): string {
  if (!t?.trim()) return fallback;
  try {
    return normalizeStoredTime(t);
  } catch {
    return fallback;
  }
}

function activeDayPlaces(draft: TripWizardDraft): DayPlaceDraft[] {
  const { startDate, endDate } = draft.basics;
  if (!startDate || !endDate) return draft.dayPlaces;

  const bufferBefore = addDays(startDate, -1);
  const bufferAfter = addDays(endDate, 1);

  return draft.dayPlaces.filter((d) => {
    if (d.date >= startDate && d.date <= endDate) return true;
    if (d.date === bufferBefore || d.date === bufferAfter) {
      return d.includeBuffer || hasActivityOnDate(draft, d.date);
    }
    return false;
  });
}

function hasActivityOnDate(draft: TripWizardDraft, date: string): boolean {
  const hasTransport = [...draft.outboundLegs, ...draft.returnLegs, ...draft.intercityLegs].some(
    (l) => l.travelDate === date,
  );
  const hasMeeting = draft.meetings.some((m) => m.date === date);
  return hasTransport || hasMeeting || draft.activities.some((a) => a.date === date);
}

export async function commitWizardShell(tripId: string, draft: TripWizardDraft) {
  const { basics } = draft;
  const timezone = await inferTimezoneFromWizardBasics({
    destinationCountries: basics.destinationCountries,
    departureCity: basics.departureCity,
    returnCity: basics.returnCity,
    dayPlaces: draft.dayPlaces,
  });

  await db
    .update(trips)
    .set({
      destinationLanguage: null,
      setupMethod: "wizard",
      updatedAt: new Date(),
    })
    .where(eq(trips.id, tripId));

  return applyTripLocationState(tripId, {
    basics: { ...basics, timezone },
    dayPlaces: activeDayPlaces(draft),
    outboundLegs: draft.outboundLegs,
    returnLegs: draft.returnLegs,
    intercityLegs: draft.intercityLegs,
    accommodationStays: draft.accommodationStays,
    transportProducts: [],
  });
}

export async function commitWizardActivities(tripId: string, draft: TripWizardDraft) {
  const dayRows = await db
    .select({ id: tripDays.id, date: tripDays.date })
    .from(tripDays)
    .where(eq(tripDays.tripId, tripId));

  const dayIdByDate = new Map(dayRows.map((d) => [d.date, d.id]));

  const wizardActivityIds = draft.activities.map((a) => a.id);
  if (wizardActivityIds.length) {
    await db
      .delete(itineraryItems)
      .where(
        and(
          eq(itineraryItems.tripId, tripId),
          eq(itineraryItems.wizardSource, "activity"),
        ),
      );
  }

  for (const act of draft.activities) {
    const dayId = dayIdByDate.get(act.date);
    if (!dayId) continue;
    const sortOrder = await nextItemSortOrder(dayId);
    await db.insert(itineraryItems).values({
      tripId,
      tripDayId: dayId,
      startTime: act.isTimeTbc ? "09:00:00" : defaultTime(act.startTime, "09:00:00"),
      endTime: act.endTime ? defaultTime(act.endTime, "10:00:00") : null,
      title: act.title,
      locationName: act.isLocationTbc ? null : act.locationName,
      address: act.address,
      mapQuery: null,
      leaveByTime: act.leaveByTime ? defaultTime(act.leaveByTime, "08:00:00") : null,
      transportNote: act.transportNote,
      bringNote: act.bringNote,
      hostNote: act.description,
      audienceType: act.audienceType,
      audienceId: act.audienceId,
      category: act.category,
      sortOrder,
      bookingStatus: toDbBookingStatus(act.bookingStatus),
      wizardSource: "activity",
      isTimeTbc: act.isTimeTbc,
      isLocationTbc: act.isLocationTbc,
    });
  }

  await db.delete(tripDayReminders).where(eq(tripDayReminders.tripId, tripId));
  for (const rem of draft.reminders) {
    const dayId = dayIdByDate.get(rem.date);
    if (!dayId) continue;
    await db.insert(tripDayReminders).values({
      tripId,
      tripDayId: dayId,
      title: rem.title,
      reminderTime: rem.reminderTime ? defaultTime(rem.reminderTime, "09:00:00") : null,
      note: rem.note,
      audienceType: rem.audienceType,
      audienceId: rem.audienceId,
      sortOrder: 0,
    });
  }

  for (const mtg of draft.meetings) {
    let dayId = dayIdByDate.get(mtg.date);
    if (!dayId) {
      const sortOrder = await nextDaySortOrder(tripId);
      const [created] = await db
        .insert(tripDays)
        .values({
          tripId,
          date: mtg.date,
          cityLabel: "Meeting",
          calendarLabel: "Meeting",
          dayType: "meeting",
          sortOrder,
        })
        .returning({ id: tripDays.id });
      dayId = created?.id;
      if (dayId) dayIdByDate.set(mtg.date, dayId);
    }
    if (!dayId) continue;

    await db
      .delete(itineraryItems)
      .where(
        and(
          eq(itineraryItems.tripId, tripId),
          eq(itineraryItems.tripDayId, dayId),
          eq(itineraryItems.wizardSource, "meeting"),
          eq(itineraryItems.title, mtg.title),
        ),
      );

    const sortOrder = await nextItemSortOrder(dayId);
    await db.insert(itineraryItems).values({
      tripId,
      tripDayId: dayId,
      startTime: mtg.time ? defaultTime(mtg.time, "12:00:00") : "12:00:00",
      endTime: null,
      title: mtg.title,
      locationName: mtg.location,
      address: null,
      mapQuery: null,
      leaveByTime: null,
      transportNote: null,
      bringNote: null,
      hostNote: [mtg.description, mtg.notes].filter(Boolean).join("\n") || null,
      audienceType: mtg.audienceType,
      audienceId: mtg.audienceId,
      category: "meeting",
      sortOrder,
      bookingStatus: null,
      wizardSource: "meeting",
      isTimeTbc: !mtg.time,
      isLocationTbc: !mtg.location,
    });
  }
}
