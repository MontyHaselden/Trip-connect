import { asc, eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import {
  tripAccommodationStays,
  tripDays,
  tripTransportLegs,
  trips,
} from "@/lib/db/schema";
import {
  groupTargetsByEntity,
  loadVisibilityTargetsForTrip,
} from "@/lib/visibility/persistence";
import { decodeTransportLegNotes } from "@/lib/host/setup/transport-leg-notes";
import type {
  AccommodationStayDraft,
  DayPlaceDraft,
  IntercityLegDraft,
  TransportLegDraft,
} from "@/lib/host/wizard/types";
import { newId } from "@/lib/host/wizard/types";

import type { TripLocationState } from "./types";

function timeFromDb(value: string | null): string | null {
  if (!value) return null;
  return value.slice(0, 5);
}

function inferPrimaryShare(day: {
  dayType: string | null;
  secondaryCityLabel: string | null;
  calendarLabel: string | null;
}): number {
  if (!day.secondaryCityLabel?.trim()) return 1;
  if (day.dayType === "travel") return 0.5;
  if (day.calendarLabel?.includes("/")) return 0.5;
  return 0.5;
}

function rowToTransportLeg(row: {
  id: string;
  transportType: TransportLegDraft["transportType"];
  bookingStatus: TransportLegDraft["bookingStatus"] | "placeholder" | "cancelled";
  travelDate: string;
  departureTime: string | null;
  arrivalTime: string | null;
  fromCity: string | null;
  toCity: string | null;
  fromStation: string | null;
  toStation: string | null;
  operator: string | null;
  referenceNumber: string | null;
  flightNumber: string | null;
  notes: string | null;
}): TransportLegDraft {
  const decoded = decodeTransportLegNotes(row.notes);
  return {
    id: row.id,
    transportType: row.transportType,
    bookingStatus:
      row.bookingStatus === "placeholder"
        ? "not_booked"
        : row.bookingStatus === "cancelled"
          ? "not_booked"
          : row.bookingStatus,
    travelDate: row.travelDate,
    arrivalDate: null,
    departureTime: timeFromDb(row.departureTime),
    arrivalTime: timeFromDb(row.arrivalTime),
    fromCity: row.fromCity ?? "",
    toCity: row.toCity ?? "",
    fromStation: row.fromStation,
    toStation: row.toStation,
    operator: row.operator,
    referenceNumber: row.referenceNumber,
    flightNumber: row.flightNumber,
    notes: decoded.notes,
    surfaceOnly: decoded.surfaceOnly || undefined,
  };
}

export async function loadTripLocationState(tripId: string): Promise<TripLocationState | null> {
  const trip = await db
    .select({
      name: trips.name,
      schoolName: trips.schoolName,
      startDate: trips.startDate,
      endDate: trips.endDate,
      timezone: trips.timezone,
      departureCity: trips.departureCity,
      returnCity: trips.returnCity,
      defaultDepartureAirport: trips.defaultDepartureAirport,
      destinationCountry: trips.destinationCountry,
    })
    .from(trips)
    .where(eq(trips.id, tripId))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (!trip) return null;

  const dayRows = await db
    .select({
      date: tripDays.date,
      cityLabel: tripDays.cityLabel,
      secondaryCityLabel: tripDays.secondaryCityLabel,
      dayType: tripDays.dayType,
      isBufferDay: tripDays.isBufferDay,
      calendarLabel: tripDays.calendarLabel,
    })
    .from(tripDays)
    .where(eq(tripDays.tripId, tripId))
    .orderBy(asc(tripDays.date));

  const legRows = await db
    .select()
    .from(tripTransportLegs)
    .where(eq(tripTransportLegs.tripId, tripId))
    .orderBy(asc(tripTransportLegs.sortOrder));

  const stayRows = await db
    .select()
    .from(tripAccommodationStays)
    .where(eq(tripAccommodationStays.tripId, tripId))
    .orderBy(asc(tripAccommodationStays.sortOrder));

  const visibilityRows = await loadVisibilityTargetsForTrip(tripId);
  const targetMap = groupTargetsByEntity(visibilityRows);

  function attachVisibility<T extends { id: string; visibilityMode?: string }>(
    entityType: "transport_leg" | "accommodation_stay",
    row: T,
  ) {
    return {
      ...row,
      visibilityMode: (row.visibilityMode ?? "everyone") as AccommodationStayDraft["visibilityMode"],
      targets: targetMap.get(`${entityType}:${row.id}`) ?? [],
    };
  }

  const dayPlaces: DayPlaceDraft[] = dayRows.map((day) => ({
    date: day.date,
    primaryCity: day.cityLabel?.trim() || "",
    secondaryCity: day.secondaryCityLabel,
    primaryShare: inferPrimaryShare(day),
    dayType: (day.dayType ?? "trip") as DayPlaceDraft["dayType"],
    includeBuffer: Boolean(day.isBufferDay),
  }));

  const outboundLegs: TransportLegDraft[] = [];
  const returnLegs: TransportLegDraft[] = [];
  const intercityLegs: IntercityLegDraft[] = [];

  for (const row of legRows) {
    const base = rowToTransportLeg(row);
    const withVisibility = attachVisibility("transport_leg", {
      ...base,
      visibilityMode: row.visibilityMode,
    });
    const withLayer = {
      ...withVisibility,
      originGroupId: row.originGroupId,
      sourceEntityId: row.sourceEntityId,
    };
    if (row.legKind === "outbound") {
      outboundLegs.push(withLayer);
    } else if (row.legKind === "return") {
      returnLegs.push(withLayer);
    } else {
      intercityLegs.push({
        ...withLayer,
        intercityFromCity: row.intercityFromCity ?? base.fromCity,
        intercityToCity: row.intercityToCity ?? base.toCity,
      });
    }
  }

  const cityStayCounts = new Map<string, number>();
  for (const stay of stayRows) {
    const key = stay.cityLabel.toLowerCase();
    cityStayCounts.set(key, (cityStayCounts.get(key) ?? 0) + 1);
  }

  const accommodationStays: AccommodationStayDraft[] = stayRows.map((stay) =>
    attachVisibility("accommodation_stay", {
      id: stay.id,
      cityLabel: stay.cityLabel,
      stayType: stay.stayType,
      name: stay.name,
      url: stay.url,
      address: stay.address,
      phone: stay.phone,
      googlePlaceId: stay.googlePlaceId,
      latitude: stay.latitude != null ? Number(stay.latitude) : null,
      longitude: stay.longitude != null ? Number(stay.longitude) : null,
      checkInDate: stay.checkInDate,
      checkOutDate: stay.checkOutDate,
      notes: stay.notes,
      isHomestayGroup: stay.isHomestayGroup,
      multipleInCity: (cityStayCounts.get(stay.cityLabel.toLowerCase()) ?? 0) > 1,
      visibilityMode: stay.visibilityMode,
      originGroupId: stay.originGroupId,
      sourceEntityId: stay.sourceEntityId,
    }),
  );

  const countries = trip.destinationCountry
    ? trip.destinationCountry.split(",").map((c) => c.trim()).filter(Boolean)
    : [];

  return {
    basics: {
      name: trip.name,
      schoolName: trip.schoolName,
      startDate: trip.startDate,
      endDate: trip.endDate,
      timezone: trip.timezone,
      departureCity: trip.departureCity ?? "",
      returnCity: trip.returnCity ?? "",
      defaultDepartureAirport: trip.defaultDepartureAirport ?? "",
      destinationCountries: countries,
    },
    dayPlaces,
    outboundLegs,
    returnLegs,
    intercityLegs,
    accommodationStays,
  };
}

/** Ensure draft IDs exist before persisting. */
export function normalizeLocationStateIds(state: TripLocationState): TripLocationState {
  return {
    ...state,
    outboundLegs: state.outboundLegs.map((l) => ({ ...l, id: l.id || newId() })),
    returnLegs: state.returnLegs.map((l) => ({ ...l, id: l.id || newId() })),
    intercityLegs: state.intercityLegs.map((l) => ({ ...l, id: l.id || newId() })),
    accommodationStays: state.accommodationStays.map((s) => ({
      ...s,
      id: s.id || newId(),
    })),
  };
}
