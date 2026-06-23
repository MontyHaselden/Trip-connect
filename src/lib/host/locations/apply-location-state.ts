import { and, eq, inArray } from "drizzle-orm";

import { db } from "@/lib/db/client";
import {
  groups,
  itineraryItems,
  rooms,
  tripAccommodationStays,
  tripDays,
  tripTransportLegs,
  trips,
} from "@/lib/db/schema";
import { shouldDeleteOrphanTransportLeg } from "@/lib/host/setup/transport-leg-sync";
import { encodeTransportLegNotes } from "@/lib/host/setup/transport-leg-notes";
import {
  isAccommodationCheckItemTitle,
  resolveCheckoutActivityTime,
} from "@/lib/host/import/reconcile-accommodation-stays";
import { inferTimezoneFromWizardBasics } from "@/lib/geo/resolve-timezone";
import { nextItemSortOrder } from "@/lib/host/itinerary-queries";
import { toDbBookingStatus, toDbTransportType } from "@/lib/host/wizard/db-enums";
import { arrivalDate as resolveLegArrivalDate } from "@/lib/host/wizard/transport-day-placement";
import { ensureMainGroupForTrip } from "@/lib/groups/main-group";
import { syncGroupDayPlaces } from "@/lib/host/setup/apply-setup-state";
import { persistEntityVisibility, resolveItemVisibility } from "@/lib/visibility/item-visibility";
import type {
  AccommodationStayDraft,
  DayPlaceDraft,
  IntercityLegDraft,
  TransportLegDraft,
} from "@/lib/host/wizard/types";
import { normalizeStoredTime } from "@/lib/utils/ai-time";

import { assertValidIsoDate } from "@/lib/utils/iso-date";

import type { TripLocationState } from "./types";

function addDays(iso: string, delta: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

function travelCalendarLabel(day: DayPlaceDraft): string | null {
  if (day.dayType === "travel" && day.secondaryCity?.trim()) {
    return `${day.primaryCity} → ${day.secondaryCity}`;
  }
  if (day.secondaryCity?.trim()) {
    return `${day.primaryCity} / ${day.secondaryCity}`;
  }
  return null;
}

function defaultTime(t: string | null, fallback: string): string {
  if (!t?.trim()) return fallback;
  try {
    return normalizeStoredTime(t);
  } catch {
    return fallback;
  }
}

function wizardItemBookingStatus(
  status: TransportLegDraft["bookingStatus"],
): "booked" | "not_booked" | "placeholder" | "flexible" | null {
  const db = toDbBookingStatus(status);
  if (db === "cancelled") return "not_booked";
  return db;
}

function transportTitle(leg: TransportLegDraft): string {
  const type = leg.transportType.charAt(0).toUpperCase() + leg.transportType.slice(1);
  const from = leg.fromCity || leg.fromStation || "departure";
  const to = leg.toCity || leg.toStation || "arrival";
  if (leg.transportType === "plane" && leg.flightNumber) {
    return `Flight ${leg.flightNumber}: ${from} → ${to}`;
  }
  return `${type}: ${from} → ${to}`;
}

async function ensureDay(
  tripId: string,
  day: DayPlaceDraft,
  sortOrder: number,
  tripDates: { startDate: string; endDate: string },
): Promise<string> {
  assertValidIsoDate(day.date, "trip day date");
  const existing = await db
    .select({ id: tripDays.id })
    .from(tripDays)
    .where(and(eq(tripDays.tripId, tripId), eq(tripDays.date, day.date)))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  const cityLabel = "TBC";
  const bufferBefore = addDays(tripDates.startDate, -1);
  const bufferAfter = addDays(tripDates.endDate, 1);
  const isBufferDay =
    day.dayType === "buffer" ||
    day.date === bufferBefore ||
    day.date === bufferAfter;

  const structuralPatch = {
    dayType: day.dayType,
    isBufferDay: isBufferDay && day.includeBuffer,
    sortOrder,
  };

  if (existing) {
    await db.update(tripDays).set(structuralPatch).where(eq(tripDays.id, existing.id));
    return existing.id;
  }

  const [created] = await db
    .insert(tripDays)
    .values({
      tripId,
      date: day.date,
      summary: null,
      cityLabel,
      calendarLabel: null,
      secondaryCityLabel: null,
      weatherLocationQuery: null,
      ...structuralPatch,
    })
    .returning({ id: tripDays.id });

  if (!created) throw new Error(`Could not create day ${day.date}`);
  return created.id;
}

/** Upsert only the given trip_days rows (no wizard items, timezone inference, or transport sync). */
export async function syncTripDaysPatch(
  tripId: string,
  daysToSync: DayPlaceDraft[],
  basics: TripLocationState["basics"],
  allDaysForSort?: DayPlaceDraft[],
): Promise<void> {
  if (!daysToSync.length) return;
  const sortSource = allDaysForSort ?? daysToSync;
  const sorted = [...sortSource].sort((a, b) => a.date.localeCompare(b.date));
  const sortOrderByDate = new Map(sorted.map((d, i) => [d.date, i] as const));
  const tripDates = { startDate: basics.startDate, endDate: basics.endDate };
  const bufferBefore = addDays(tripDates.startDate, -1);
  const bufferAfter = addDays(tripDates.endDate, 1);

  const dates = daysToSync.map((d) => d.date);
  const existingRows = await db
    .select({ id: tripDays.id, date: tripDays.date })
    .from(tripDays)
    .where(and(eq(tripDays.tripId, tripId), inArray(tripDays.date, dates)));

  const existingByDate = new Map(
    existingRows.map((row) => [row.date, row.id] as const),
  );

  const toInsert: Array<{
    tripId: string;
    date: string;
    summary: null;
    cityLabel: string;
    calendarLabel: null;
    secondaryCityLabel: null;
    weatherLocationQuery: null;
    dayType: DayPlaceDraft["dayType"];
    isBufferDay: boolean;
    sortOrder: number;
  }> = [];
  const toUpdate: Array<{
    id: string;
    patch: {
      dayType: DayPlaceDraft["dayType"];
      isBufferDay: boolean;
      sortOrder: number;
    };
  }> = [];

  for (const day of daysToSync) {
    assertValidIsoDate(day.date, "trip day date");
    const sortOrder = sortOrderByDate.get(day.date) ?? 0;
    const isBufferDay =
      day.dayType === "buffer" ||
      day.date === bufferBefore ||
      day.date === bufferAfter;
    const structuralPatch = {
      dayType: day.dayType,
      isBufferDay: isBufferDay && day.includeBuffer,
      sortOrder,
    };

    const existingId = existingByDate.get(day.date);
    if (existingId) {
      toUpdate.push({ id: existingId, patch: structuralPatch });
      continue;
    }

    toInsert.push({
      tripId,
      date: day.date,
      summary: null,
      cityLabel: "TBC",
      calendarLabel: null,
      secondaryCityLabel: null,
      weatherLocationQuery: null,
      ...structuralPatch,
    });
  }

  await Promise.all(
    toUpdate.map(({ id, patch }) =>
      db.update(tripDays).set(patch).where(eq(tripDays.id, id)),
    ),
  );

  if (toInsert.length) {
    await db.insert(tripDays).values(toInsert);
  }
}

async function upsertWizardItem(params: {
  tripId: string;
  dayId: string;
  wizardSource: "outbound" | "return" | "intercity" | "accommodation";
  fingerprint: string;
  title: string;
  startTime: string;
  endTime: string | null;
  locationName: string | null;
  transportNote: string | null;
  bookingStatus: "booked" | "not_booked" | "placeholder" | "flexible" | null;
  category: "travel" | "hotel";
}) {
  const existing = await db
    .select({ id: itineraryItems.id })
    .from(itineraryItems)
    .where(
      and(
        eq(itineraryItems.tripId, params.tripId),
        eq(itineraryItems.tripDayId, params.dayId),
        eq(itineraryItems.wizardSource, params.wizardSource),
        eq(itineraryItems.title, params.title),
      ),
    )
    .limit(1)
    .then((rows) => rows[0] ?? null);

  const values = {
    tripId: params.tripId,
    tripDayId: params.dayId,
    startTime: params.startTime,
    endTime: params.endTime,
    title: params.title,
    locationName: params.locationName,
    address: null,
    mapQuery: null,
    leaveByTime: null,
    transportNote: params.transportNote,
    bringNote: null,
    hostNote: params.fingerprint,
    audienceType: "everyone" as const,
    audienceId: null,
    category: params.category,
    bookingStatus: params.bookingStatus,
    wizardSource: params.wizardSource,
    isTimeTbc: false,
    isLocationTbc: !params.locationName,
  };

  if (existing) {
    await db.update(itineraryItems).set(values).where(eq(itineraryItems.id, existing.id));
    return existing.id;
  }

  const sortOrder = await nextItemSortOrder(params.dayId);
  const [created] = await db
    .insert(itineraryItems)
    .values({ ...values, sortOrder })
    .returning({ id: itineraryItems.id });
  return created?.id;
}

function legToRow(
  tripId: string,
  leg: TransportLegDraft,
  kind: "outbound" | "return" | "intercity",
) {
  const visibility = resolveItemVisibility(leg);
  return {
    id: leg.id,
    tripId,
    legKind: kind,
    transportType: toDbTransportType(leg.transportType),
    bookingStatus: toDbBookingStatus(leg.bookingStatus),
    travelDate: leg.travelDate,
    departureTime: leg.departureTime ? defaultTime(leg.departureTime, "09:00:00") : null,
    arrivalTime: leg.arrivalTime ? defaultTime(leg.arrivalTime, "12:00:00") : null,
    fromCity: leg.fromCity || null,
    toCity: leg.toCity || null,
    fromStation: leg.fromStation,
    toStation: leg.toStation,
    operator: leg.operator,
    referenceNumber: leg.referenceNumber,
    flightNumber: leg.flightNumber,
    notes: encodeTransportLegNotes(leg as { notes: string | null; surfaceOnly?: boolean }),
    intercityFromCity: null as string | null,
    intercityToCity: null as string | null,
    sortOrder: 0,
    visibilityMode: visibility.visibilityMode,
  };
}

export async function syncTransportLegsTable(
  tripId: string,
  mainGroupId: string | null,
  outbound: TransportLegDraft[],
  returnLegs: TransportLegDraft[],
  intercity: IntercityLegDraft[],
) {
  const allLegs = [...outbound, ...returnLegs, ...intercity];
  const incomingIds = new Set(allLegs.map((l) => l.id));

  const [existing, tripGroups] = await Promise.all([
    db
      .select({
        id: tripTransportLegs.id,
        legKind: tripTransportLegs.legKind,
        originGroupId: tripTransportLegs.originGroupId,
      })
      .from(tripTransportLegs)
      .where(eq(tripTransportLegs.tripId, tripId)),
    db
      .select({ id: groups.id })
      .from(groups)
      .where(eq(groups.tripId, tripId)),
  ]);
  const activeGroupIds = new Set(tripGroups.map((g) => g.id));

  for (const row of existing) {
    if (
      shouldDeleteOrphanTransportLeg(row, incomingIds, mainGroupId, activeGroupIds)
    ) {
      await db.delete(tripTransportLegs).where(eq(tripTransportLegs.id, row.id));
    }
  }

  const rows = [
    ...outbound.map((l, i) => ({ ...legToRow(tripId, l, "outbound"), sortOrder: i })),
    ...returnLegs.map((l, i) => ({
      ...legToRow(tripId, l, "return"),
      sortOrder: outbound.length + i,
    })),
    ...intercity.map((l, i) => ({
      ...legToRow(tripId, l, "intercity"),
      intercityFromCity: l.intercityFromCity,
      intercityToCity: l.intercityToCity,
      sortOrder: outbound.length + returnLegs.length + i,
    })),
  ];

  const existingIds = new Set(existing.map((r) => r.id));
  for (const row of rows) {
    const leg = allLegs.find((l) => l.id === row.id);
    const visibility = resolveItemVisibility(leg ?? { visibilityMode: row.visibilityMode });
    const withOrigin = { ...row, originGroupId: mainGroupId };
    if (existingIds.has(row.id)) {
      await db
        .update(tripTransportLegs)
        .set(withOrigin)
        .where(eq(tripTransportLegs.id, row.id));
    } else {
      await db.insert(tripTransportLegs).values(withOrigin);
    }
    await persistEntityVisibility(
      tripId,
      "transport_leg",
      row.id,
      visibility.visibilityMode,
      visibility.targets,
    );
  }
}

export async function syncAccommodationStays(
  tripId: string,
  mainGroupId: string | null,
  stays: AccommodationStayDraft[],
) {
  const incomingIds = new Set(stays.map((s) => s.id));
  const existing = await db
    .select({
      id: tripAccommodationStays.id,
      originGroupId: tripAccommodationStays.originGroupId,
    })
    .from(tripAccommodationStays)
    .where(eq(tripAccommodationStays.tripId, tripId));

  for (const row of existing) {
    if (!incomingIds.has(row.id)) {
      const isMainScoped =
        !row.originGroupId || row.originGroupId === mainGroupId;
      if (isMainScoped) {
        await db.delete(tripAccommodationStays).where(eq(tripAccommodationStays.id, row.id));
      }
    }
  }

  const existingIds = new Set(existing.map((r) => r.id));

  for (let i = 0; i < stays.length; i++) {
    const s = stays[i]!;
    const visibility = resolveItemVisibility(s);
    const values = {
      tripId,
      cityLabel: s.cityLabel,
      stayType: s.stayType,
      name: s.name,
      url: s.url,
      address: s.address,
      phone: s.phone,
      googlePlaceId: s.googlePlaceId ?? null,
      latitude: s.latitude != null ? String(s.latitude) : null,
      longitude: s.longitude != null ? String(s.longitude) : null,
      checkInDate: s.checkInDate,
      checkOutDate: s.checkOutDate,
      notes: s.notes,
      isHomestayGroup: s.isHomestayGroup,
      sortOrder: i,
      visibilityMode: visibility.visibilityMode,
    };

    const withOrigin = {
      ...values,
      originGroupId: mainGroupId,
    };
    if (existingIds.has(s.id)) {
      await db
        .update(tripAccommodationStays)
        .set(withOrigin)
        .where(eq(tripAccommodationStays.id, s.id));
    } else {
      await db.insert(tripAccommodationStays).values({ id: s.id, ...withOrigin });
    }

    await persistEntityVisibility(
      tripId,
      "accommodation_stay",
      s.id,
      visibility.visibilityMode,
      visibility.targets,
    );

    if (s.stayType === "multiple_hotels" || s.stayType === "multiple_hosts") {
      const existingRoom = await db
        .select({ id: rooms.id })
        .from(rooms)
        .where(and(eq(rooms.tripId, tripId), eq(rooms.hotelName, s.cityLabel)))
        .limit(1)
        .then((rows) => rows[0] ?? null);
      if (!existingRoom) {
        await db.insert(rooms).values({
          tripId,
          roomName: "TBC",
          hotelName: s.name || s.cityLabel,
          hotelAddress: s.address,
          notes: s.notes,
          sortOrder: 0,
        });
      }
    }
  }
}

function activeDayPlaces(
  state: TripLocationState,
): DayPlaceDraft[] {
  const { startDate, endDate } = state.basics;
  if (!startDate || !endDate) return state.dayPlaces;

  const bufferBefore = addDays(startDate, -1);
  const bufferAfter = addDays(endDate, 1);

  return state.dayPlaces.filter((d) => {
    if (d.date >= startDate && d.date <= endDate) return true;
    if (d.date === bufferBefore || d.date === bufferAfter) {
      return d.includeBuffer;
    }
    return false;
  });
}

/** Drop check-in/out timeline rows — stays still paint on the calendar via tripAccommodationStays. */
export async function purgeAccommodationWizardItineraryItems(tripId: string): Promise<void> {
  await db
    .delete(itineraryItems)
    .where(
      and(
        eq(itineraryItems.tripId, tripId),
        eq(itineraryItems.wizardSource, "accommodation"),
      ),
    );

  const activityRows = await db
    .select({ id: itineraryItems.id, title: itineraryItems.title })
    .from(itineraryItems)
    .where(
      and(eq(itineraryItems.tripId, tripId), eq(itineraryItems.wizardSource, "activity")),
    );

  for (const row of activityRows) {
    if (isAccommodationCheckItemTitle(row.title)) {
      await db.delete(itineraryItems).where(eq(itineraryItems.id, row.id));
    }
  }
}

export async function applyTripLocationState(
  tripId: string,
  state: TripLocationState,
  options?: { syncTransportItems?: boolean; syncAccommodationItems?: boolean },
): Promise<{ dayCount: number }> {
  const mainGroupId = await ensureMainGroupForTrip(tripId);
  const { basics } = state;
  const countries = basics.destinationCountries.filter(Boolean).join(", ") || null;
  const timezone = await inferTimezoneFromWizardBasics({
    destinationCountries: basics.destinationCountries,
    departureCity: basics.departureCity,
    returnCity: basics.returnCity,
    dayPlaces: state.dayPlaces,
  });

  await db
    .update(trips)
    .set({
      name: basics.name.trim(),
      schoolName: basics.schoolName.trim(),
      startDate: basics.startDate,
      endDate: basics.endDate,
      destinationCountry: countries,
      timezone: basics.timezone || timezone,
      departureCity: basics.departureCity || null,
      returnCity: basics.returnCity || null,
      defaultDepartureAirport: basics.defaultDepartureAirport?.trim() || null,
      updatedAt: new Date(),
    })
    .where(eq(trips.id, tripId));

  const daysToCreate = activeDayPlaces(state);
  const sorted = [...daysToCreate].sort((a, b) => a.date.localeCompare(b.date));
  const tripDates = { startDate: basics.startDate, endDate: basics.endDate };
  const dayIdByDate = new Map<string, string>();

  for (let i = 0; i < sorted.length; i++) {
    const dayId = await ensureDay(tripId, sorted[i]!, i, tripDates);
    dayIdByDate.set(sorted[i]!.date, dayId);
  }

  await syncTransportLegsTable(
    tripId,
    mainGroupId,
    state.outboundLegs,
    state.returnLegs,
    state.intercityLegs,
  );
  await syncAccommodationStays(tripId, mainGroupId, state.accommodationStays);

  const allLegs: Array<{
    leg: TransportLegDraft;
    source: "outbound" | "return" | "intercity";
  }> = [
    ...state.outboundLegs.map((leg) => ({ leg, source: "outbound" as const })),
    ...state.returnLegs.map((leg) => ({ leg, source: "return" as const })),
    ...state.intercityLegs.map((leg) => ({ leg, source: "intercity" as const })),
  ];

  if (options?.syncTransportItems !== false) {
    await db
      .delete(itineraryItems)
      .where(
        and(
          eq(itineraryItems.tripId, tripId),
          eq(itineraryItems.wizardSource, "outbound"),
        ),
      );
    await db
      .delete(itineraryItems)
      .where(
        and(
          eq(itineraryItems.tripId, tripId),
          eq(itineraryItems.wizardSource, "return"),
        ),
      );
    await db
      .delete(itineraryItems)
      .where(
        and(
          eq(itineraryItems.tripId, tripId),
          eq(itineraryItems.wizardSource, "intercity"),
        ),
      );

    for (const { leg, source } of allLegs) {
      const dayId = dayIdByDate.get(leg.travelDate);
      if (!dayId) continue;

      const departTime = defaultTime(leg.departureTime, "09:00:00");
      await upsertWizardItem({
        tripId,
        dayId,
        wizardSource: source,
        fingerprint: `${source}:${leg.id}:depart`,
        title: transportTitle(leg),
        startTime: departTime,
        endTime: leg.arrivalTime ? defaultTime(leg.arrivalTime, "12:00:00") : null,
        locationName: leg.fromStation || leg.fromCity || null,
        transportNote: leg.notes,
        bookingStatus: wizardItemBookingStatus(leg.bookingStatus),
        category: "travel",
      });

      const arrivalDayId = dayIdByDate.get(resolveLegArrivalDate(leg));
      if (leg.arrivalTime && (leg.toStation || leg.toCity) && arrivalDayId) {
        await upsertWizardItem({
          tripId,
          dayId: arrivalDayId,
          wizardSource: source,
          fingerprint: `${source}:${leg.id}:arrive`,
          title: `Arrive ${leg.toStation || leg.toCity}`,
          startTime: defaultTime(leg.arrivalTime, "12:00:00"),
          endTime: null,
          locationName: leg.toStation || leg.toCity || null,
          transportNote: null,
          bookingStatus: wizardItemBookingStatus(leg.bookingStatus),
          category: "travel",
        });
      }
    }
  }

  if (options?.syncAccommodationItems !== false) {
  await db
    .delete(itineraryItems)
    .where(
      and(
        eq(itineraryItems.tripId, tripId),
        eq(itineraryItems.wizardSource, "accommodation"),
      ),
    );

  const activityRows = await db
    .select({ id: itineraryItems.id, title: itineraryItems.title })
    .from(itineraryItems)
    .where(
      and(eq(itineraryItems.tripId, tripId), eq(itineraryItems.wizardSource, "activity")),
    );

  for (const row of activityRows) {
    if (isAccommodationCheckItemTitle(row.title)) {
      await db.delete(itineraryItems).where(eq(itineraryItems.id, row.id));
    }
  }

  for (const stay of state.accommodationStays) {
    const checkInDayId = dayIdByDate.get(stay.checkInDate);
    if (checkInDayId && stay.name) {
      await upsertWizardItem({
        tripId,
        dayId: checkInDayId,
        wizardSource: "accommodation",
        fingerprint: `stay:${stay.id}:checkin`,
        title: `Check in: ${stay.name}`,
        startTime: "15:00:00",
        endTime: null,
        locationName: stay.name,
        transportNote: stay.address,
        bookingStatus: stay.stayType === "not_booked" ? "not_booked" : "booked",
        category: "hotel",
      });
    }
    const checkOutDayId = dayIdByDate.get(stay.checkOutDate);
    if (checkOutDayId && stay.name) {
      await upsertWizardItem({
        tripId,
        dayId: checkOutDayId,
        wizardSource: "accommodation",
        fingerprint: `stay:${stay.id}:checkout`,
        title: `Check out: ${stay.name}`,
        startTime: resolveCheckoutActivityTime(stay, stay.checkOutDate, allLegs.map((x) => x.leg)),
        endTime: null,
        locationName: stay.name,
        transportNote: null,
        bookingStatus: stay.stayType === "not_booked" ? "not_booked" : "booked",
        category: "hotel",
      });
    }
  }
  }

  await syncGroupDayPlaces(tripId, mainGroupId, state.dayPlaces);

  return { dayCount: sorted.length };
}
