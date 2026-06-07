import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import {
  itineraryItems,
  rooms,
  tripAccommodationStays,
  tripDays,
  tripTransportLegs,
  trips,
} from "@/lib/db/schema";
import { inferTimezoneFromWizardBasics } from "@/lib/geo/resolve-timezone";
import { nextItemSortOrder } from "@/lib/host/itinerary-queries";
import { toDbBookingStatus, toDbTransportType } from "@/lib/host/wizard/db-enums";
import { arrivalDate as resolveLegArrivalDate } from "@/lib/host/wizard/transport-day-placement";
import type {
  AccommodationStayDraft,
  DayPlaceDraft,
  IntercityLegDraft,
  TransportLegDraft,
} from "@/lib/host/wizard/types";
import { normalizeStoredTime } from "@/lib/utils/ai-time";

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
  const existing = await db
    .select({ id: tripDays.id })
    .from(tripDays)
    .where(and(eq(tripDays.tripId, tripId), eq(tripDays.date, day.date)))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  const cityLabel = day.primaryCity.trim() || "TBC";
  const calLabel = travelCalendarLabel(day);
  const bufferBefore = addDays(tripDates.startDate, -1);
  const bufferAfter = addDays(tripDates.endDate, 1);
  const isBufferDay =
    day.dayType === "buffer" ||
    day.date === bufferBefore ||
    day.date === bufferAfter;

  const patch = {
    cityLabel,
    calendarLabel: calLabel,
    dayType: day.dayType,
    secondaryCityLabel: day.secondaryCity,
    isBufferDay: isBufferDay && day.includeBuffer,
    weatherLocationQuery: cityLabel !== "TBC" ? cityLabel : null,
    sortOrder,
  };

  if (existing) {
    await db.update(tripDays).set(patch).where(eq(tripDays.id, existing.id));
    return existing.id;
  }

  const [created] = await db
    .insert(tripDays)
    .values({
      tripId,
      date: day.date,
      summary: null,
      ...patch,
    })
    .returning({ id: tripDays.id });

  if (!created) throw new Error(`Could not create day ${day.date}`);
  return created.id;
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
  bookingStatus: "booked" | "not_booked" | "placeholder" | null;
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
  return {
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
    notes: leg.notes,
    intercityFromCity: null as string | null,
    intercityToCity: null as string | null,
    sortOrder: 0,
  };
}

async function syncTransportLegsTable(
  tripId: string,
  outbound: TransportLegDraft[],
  returnLegs: TransportLegDraft[],
  intercity: IntercityLegDraft[],
) {
  await db.delete(tripTransportLegs).where(eq(tripTransportLegs.tripId, tripId));

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

  if (rows.length) {
    await db.insert(tripTransportLegs).values(rows);
  }
}

async function syncAccommodationStays(tripId: string, stays: AccommodationStayDraft[]) {
  await db.delete(tripAccommodationStays).where(eq(tripAccommodationStays.tripId, tripId));

  if (!stays.length) return;

  await db.insert(tripAccommodationStays).values(
    stays.map((s, i) => ({
      tripId,
      cityLabel: s.cityLabel,
      stayType: s.stayType,
      name: s.name,
      url: s.url,
      address: s.address,
      phone: s.phone,
      checkInDate: s.checkInDate,
      checkOutDate: s.checkOutDate,
      notes: s.notes,
      isHomestayGroup: s.isHomestayGroup,
      sortOrder: i,
    })),
  );

  for (const stay of stays) {
    if (stay.stayType === "multiple_hotels" || stay.stayType === "multiple_hosts") {
      const existingRoom = await db
        .select({ id: rooms.id })
        .from(rooms)
        .where(and(eq(rooms.tripId, tripId), eq(rooms.hotelName, stay.cityLabel)))
        .limit(1)
        .then((rows) => rows[0] ?? null);
      if (!existingRoom) {
        await db.insert(rooms).values({
          tripId,
          roomName: "TBC",
          hotelName: stay.name || stay.cityLabel,
          hotelAddress: stay.address,
          notes: stay.notes,
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

export async function applyTripLocationState(
  tripId: string,
  state: TripLocationState,
  options?: { syncTransportItems?: boolean },
): Promise<{ dayCount: number }> {
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
    state.outboundLegs,
    state.returnLegs,
    state.intercityLegs,
  );
  await syncAccommodationStays(tripId, state.accommodationStays);

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
    await db
      .delete(itineraryItems)
      .where(
        and(
          eq(itineraryItems.tripId, tripId),
          eq(itineraryItems.wizardSource, "accommodation"),
        ),
      );

    const allLegs: Array<{
      leg: TransportLegDraft;
      source: "outbound" | "return" | "intercity";
    }> = [
      ...state.outboundLegs.map((leg) => ({ leg, source: "outbound" as const })),
      ...state.returnLegs.map((leg) => ({ leg, source: "return" as const })),
      ...state.intercityLegs.map((leg) => ({ leg, source: "intercity" as const })),
    ];

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
        bookingStatus: toDbBookingStatus(leg.bookingStatus),
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
          bookingStatus: toDbBookingStatus(leg.bookingStatus),
          category: "travel",
        });
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
          startTime: "10:00:00",
          endTime: null,
          locationName: stay.name,
          transportNote: null,
          bookingStatus: stay.stayType === "not_booked" ? "not_booked" : "booked",
          category: "hotel",
        });
      }
    }
  }

  return { dayCount: sorted.length };
}
