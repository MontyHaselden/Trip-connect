import { and, asc, eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import {
  itineraryItems,
  tripAccommodationStays,
  tripDays,
  tripTransportLegs,
  trips,
} from "@/lib/db/schema";
import { stayForNight } from "@/lib/host/locations/accommodation-colors";

export type ImportGap = {
  id: string;
  kind:
    | "missing_city"
    | "city_change_no_transport"
    | "missing_hotel"
    | "missing_outbound"
    | "missing_return";
  message: string;
  date?: string;
  fromCity?: string;
  toCity?: string;
};

export function shortCity(label: string): string {
  return label.split(",")[0]?.trim() || label.trim();
}

export function isMissingCity(label: string): boolean {
  const city = label.trim();
  return !city || city === "TBC" || city.toLowerCase() === "unknown";
}

export function citiesMatch(a: string, b: string): boolean {
  const aTrim = a.trim();
  const bTrim = b.trim();
  if (!aTrim || !bTrim) return false;
  if (aTrim.toLowerCase() === bTrim.toLowerCase()) return true;
  return shortCity(aTrim).toLowerCase() === shortCity(bTrim).toLowerCase();
}

/** Human label for a regional / intercity move — e.g. "Tokyo to Osaka". */
export function formatCityLegLabel(fromCity: string, toCity: string): string {
  return `${shortCity(fromCity)} to ${shortCity(toCity)}`;
}

type DayRow = {
  date: string;
  cityLabel: string;
  secondaryCityLabel: string | null;
  dayType: string | null;
};

type LegRow = {
  legKind: string;
  travelDate: string;
  fromCity: string | null;
  toCity: string | null;
  intercityFromCity: string | null;
  intercityToCity: string | null;
};

export function dayNeedsCityLabel(
  day: DayRow,
  opts: { travelItemDates: Set<string>; legDates: Set<string> },
): boolean {
  if (!isMissingCity(day.cityLabel)) return false;
  if (day.dayType === "travel" || day.dayType === "return") return false;
  if (opts.legDates.has(day.date)) return false;
  if (opts.travelItemDates.has(day.date)) return false;
  if (day.secondaryCityLabel?.trim() && !isMissingCity(day.secondaryCityLabel)) {
    return false;
  }
  return true;
}

export function intercityLegCoversChange(
  leg: LegRow,
  prevDate: string,
  currDate: string,
  fromCity: string,
  toCity: string,
): boolean {
  if (leg.legKind !== "intercity") return false;
  const legFrom = leg.intercityFromCity ?? leg.fromCity ?? "";
  const legTo = leg.intercityToCity ?? leg.toCity ?? "";
  if (!citiesMatch(legFrom, fromCity) || !citiesMatch(legTo, toCity)) return false;
  return leg.travelDate === currDate || leg.travelDate === prevDate;
}

export async function analyzeImportGaps(tripId: string): Promise<ImportGap[]> {
  const gaps: ImportGap[] = [];

  const trip = await db
    .select({
      startDate: trips.startDate,
      endDate: trips.endDate,
      departureCity: trips.departureCity,
      returnCity: trips.returnCity,
    })
    .from(trips)
    .where(eq(trips.id, tripId))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (!trip) return gaps;

  const days = await db
    .select({
      id: tripDays.id,
      date: tripDays.date,
      cityLabel: tripDays.cityLabel,
      secondaryCityLabel: tripDays.secondaryCityLabel,
      dayType: tripDays.dayType,
      isBufferDay: tripDays.isBufferDay,
    })
    .from(tripDays)
    .where(eq(tripDays.tripId, tripId))
    .orderBy(asc(tripDays.date));

  const legs = await db
    .select({
      legKind: tripTransportLegs.legKind,
      travelDate: tripTransportLegs.travelDate,
      fromCity: tripTransportLegs.fromCity,
      toCity: tripTransportLegs.toCity,
      intercityFromCity: tripTransportLegs.intercityFromCity,
      intercityToCity: tripTransportLegs.intercityToCity,
    })
    .from(tripTransportLegs)
    .where(eq(tripTransportLegs.tripId, tripId));

  const travelItemRows = await db
    .select({ date: tripDays.date })
    .from(itineraryItems)
    .innerJoin(tripDays, eq(itineraryItems.tripDayId, tripDays.id))
    .where(and(eq(itineraryItems.tripId, tripId), eq(itineraryItems.category, "travel")));

  const travelItemDates = new Set(travelItemRows.map((row) => row.date));
  const legDates = new Set(legs.map((leg) => leg.travelDate));

  const stays = await db
    .select({
      id: tripAccommodationStays.id,
      cityLabel: tripAccommodationStays.cityLabel,
      name: tripAccommodationStays.name,
      checkInDate: tripAccommodationStays.checkInDate,
      checkOutDate: tripAccommodationStays.checkOutDate,
    })
    .from(tripAccommodationStays)
    .where(eq(tripAccommodationStays.tripId, tripId));

  const tripDaysOnly = days.filter(
    (d) => d.date >= trip.startDate && d.date <= trip.endDate && !d.isBufferDay,
  );

  const dayContext = { travelItemDates, legDates };

  for (const day of tripDaysOnly) {
    if (!dayNeedsCityLabel(day, dayContext)) continue;
    gaps.push({
      id: `city-${day.date}`,
      kind: "missing_city",
      message: `${day.date}: set the city or location for this day`,
      date: day.date,
    });
  }

  for (let i = 1; i < tripDaysOnly.length; i++) {
    const prev = tripDaysOnly[i - 1]!;
    const curr = tripDaysOnly[i]!;
    const prevCity = prev.cityLabel.trim();
    const currCity = curr.cityLabel.trim();
    if (isMissingCity(prevCity) || isMissingCity(currCity)) continue;
    if (citiesMatch(prevCity, currCity)) continue;

    const travelDayCovered =
      curr.dayType === "travel" &&
      curr.secondaryCityLabel?.trim() &&
      citiesMatch(curr.secondaryCityLabel, currCity);

    const intercityCovered = legs.some((leg) =>
      intercityLegCoversChange(leg, prev.date, curr.date, prevCity, currCity),
    );

    if (!travelDayCovered && !intercityCovered) {
      gaps.push({
        id: `transport-${curr.date}`,
        kind: "city_change_no_transport",
        message: `${curr.date}: ${formatCityLegLabel(prevCity, currCity)}`,
        date: curr.date,
        fromCity: prevCity,
        toCity: currCity,
      });
    }
  }

  for (let i = 0; i < tripDaysOnly.length - 1; i++) {
    const day = tripDaysOnly[i]!;
    const city = day.cityLabel.trim();
    if (isMissingCity(city)) continue;

    const nightStay = stayForNight(day.date, stays);
    if (!nightStay) {
      gaps.push({
        id: `hotel-${day.date}`,
        kind: "missing_hotel",
        message: `${day.date}: where is the group staying in ${shortCity(city)}?`,
        date: day.date,
        toCity: city,
      });
    }
  }

  const hasOutbound = legs.some((l) => l.legKind === "outbound");
  if (!hasOutbound) {
    gaps.push({
      id: "outbound-transport",
      kind: "missing_outbound",
      message: `Outbound travel on ${trip.startDate} not found`,
      date: trip.startDate,
      fromCity: trip.departureCity ?? undefined,
    });
  }

  const hasReturn = legs.some((l) => l.legKind === "return");
  if (!hasReturn) {
    gaps.push({
      id: "return-transport",
      kind: "missing_return",
      message: `Return travel on ${trip.endDate} not found`,
      date: trip.endDate,
      toCity: trip.returnCity ?? undefined,
    });
  }

  return gaps;
}
