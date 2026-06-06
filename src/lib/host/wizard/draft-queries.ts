import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { hostTripMembers, tripWizardDrafts, trips } from "@/lib/db/schema";
import { tripDatesAreUnset } from "@/lib/host/trip-dates";

import { inferTimezoneFromWizardBasics } from "@/lib/geo/resolve-timezone";

import { emptyWizardDraft, type TripWizardDraft } from "./types";
import { parseWizardDraft } from "./validate";

export type TripWizardContext = {
  name: string;
  schoolName: string;
  startDate: string;
  endDate: string;
  timezone: string;
  destinationCountry: string | null;
  destinationLanguage: string | null;
  departureCity: string | null;
  returnCity: string | null;
};

export async function getTripWizardContext(tripId: string): Promise<TripWizardContext | null> {
  const row = await db
    .select({
      name: trips.name,
      schoolName: trips.schoolName,
      startDate: trips.startDate,
      endDate: trips.endDate,
      timezone: trips.timezone,
      destinationCountry: trips.destinationCountry,
      destinationLanguage: trips.destinationLanguage,
      departureCity: trips.departureCity,
      returnCity: trips.returnCity,
    })
    .from(trips)
    .where(eq(trips.id, tripId))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  return row;
}

export function hydrateWizardDraftFromTrip(
  draft: TripWizardDraft,
  trip: TripWizardContext,
): TripWizardDraft {
  const next = { ...draft, basics: { ...draft.basics } };

  if (!next.basics.name.trim()) {
    next.basics.name = trip.name;
  }
  if (!next.basics.schoolName.trim()) {
    next.basics.schoolName = trip.schoolName;
  }
  if (!next.basics.timezone.trim()) {
    next.basics.timezone = trip.timezone;
  }
  if (!next.basics.startDate && !tripDatesAreUnset(trip.startDate, trip.endDate)) {
    next.basics.startDate = trip.startDate;
  }
  if (!next.basics.endDate && !tripDatesAreUnset(trip.startDate, trip.endDate)) {
    next.basics.endDate = trip.endDate;
  }
  if (!next.basics.destinationCountries.length && trip.destinationCountry) {
    next.basics.destinationCountries = trip.destinationCountry
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (!next.basics.departureCity.trim() && trip.departureCity) {
    next.basics.departureCity = trip.departureCity;
  }
  if (!next.basics.returnCity.trim() && trip.returnCity) {
    next.basics.returnCity = trip.returnCity;
  }

  return next;
}

export async function assertHostTripAccess(hostId: string, tripId: string) {
  const row = await db
    .select({ id: trips.id, setupMethod: trips.setupMethod })
    .from(trips)
    .innerJoin(hostTripMembers, eq(hostTripMembers.tripId, trips.id))
    .where(and(eq(hostTripMembers.hostId, hostId), eq(trips.id, tripId)))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (!row) throw new Error("Unauthorized");
  return row;
}

export async function getWizardDraft(tripId: string): Promise<{
  currentStep: number;
  draft: TripWizardDraft;
} | null> {
  const row = await db
    .select({
      currentStep: tripWizardDrafts.currentStep,
      draftJson: tripWizardDrafts.draftJson,
    })
    .from(tripWizardDrafts)
    .where(eq(tripWizardDrafts.tripId, tripId))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (!row) return null;
  return {
    currentStep: row.currentStep,
    draft: parseWizardDraft(row.draftJson),
  };
}

export async function ensureWizardDraft(tripId: string, tripName: string) {
  const existing = await getWizardDraft(tripId);
  if (existing) return existing;

  const draft = emptyWizardDraft(tripName);
  draft.basics.name = tripName;

  await db.insert(tripWizardDrafts).values({
    tripId,
    currentStep: 1,
    draftJson: draft,
  });

  return { currentStep: 1, draft };
}

export async function syncTripFromWizardDraft(tripId: string, draft: TripWizardDraft) {
  const name = draft.basics.name.trim();
  const schoolName = draft.basics.schoolName.trim();
  const countries = draft.basics.destinationCountries.filter(Boolean).join(", ") || null;

  await db
    .update(trips)
    .set({
      ...(name.length >= 2 ? { name } : {}),
      ...(schoolName ? { schoolName } : {}),
      ...(draft.basics.timezone.trim() ? { timezone: draft.basics.timezone.trim() } : {}),
      ...(draft.basics.startDate ? { startDate: draft.basics.startDate } : {}),
      ...(draft.basics.endDate ? { endDate: draft.basics.endDate } : {}),
      destinationCountry: countries,
      destinationLanguage: null,
      departureCity: draft.basics.departureCity.trim() || null,
      returnCity: draft.basics.returnCity.trim() || null,
      updatedAt: new Date(),
    })
    .where(eq(trips.id, tripId));
}

export async function saveWizardDraft(
  tripId: string,
  currentStep: number,
  draft: TripWizardDraft,
) {
  const parsed = parseWizardDraft(draft);
  const timezone = await inferTimezoneFromWizardBasics({
    destinationCountries: parsed.basics.destinationCountries,
    departureCity: parsed.basics.departureCity,
    returnCity: parsed.basics.returnCity,
    dayPlaces: parsed.dayPlaces,
  });
  const withTimezone: TripWizardDraft = {
    ...parsed,
    basics: { ...parsed.basics, timezone, destinationLanguages: [] },
  };
  await syncTripFromWizardDraft(tripId, withTimezone);
  await db
    .insert(tripWizardDrafts)
    .values({
      tripId,
      currentStep,
      draftJson: withTimezone,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: tripWizardDrafts.tripId,
      set: {
        currentStep,
        draftJson: withTimezone,
        updatedAt: new Date(),
      },
    });
}
