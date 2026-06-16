import { placesShareMetro } from "@/lib/geo/airport-codes";
import { locationsMatch } from "@/lib/host/wizard/location-stays";
import { TRIP_DATES_UNSET } from "@/lib/host/trip-date-display";
import {
  arrivalDate,
  finalReturnLeg,
  primaryReturnLeg,
} from "@/lib/host/wizard/transport-day-placement";
import type {
  AccommodationStayDraft,
  ActivityDraft,
  DayPlaceDraft,
  IntercityLegDraft,
  TransportLegDraft,
} from "@/lib/host/wizard/types";

function addDays(iso: string, delta: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

function isMeaningfulDate(iso: string | null | undefined): iso is string {
  const trimmed = iso?.trim() ?? "";
  return Boolean(trimmed) && trimmed !== TRIP_DATES_UNSET;
}

export type TripBoundsFromContent = {
  startDate: string;
  endDate: string;
};

type BoundsInput = {
  accommodationStays?: AccommodationStayDraft[];
  outboundLegs?: TransportLegDraft[];
  returnLegs?: TransportLegDraft[];
  intercityLegs?: IntercityLegDraft[];
  dayPlaces?: DayPlaceDraft[];
  activities?: ActivityDraft[];
  returnCity?: string;
};

function allLegs(input: BoundsInput): TransportLegDraft[] {
  return [
    ...(input.outboundLegs ?? []),
    ...(input.returnLegs ?? []),
    ...(input.intercityLegs ?? []),
  ];
}

function legDepartsFromAbroad(
  leg: TransportLegDraft,
  returnCity: string,
): boolean {
  const ret = returnCity.trim();
  if (!ret) return true;
  const from = leg.fromCity.trim();
  if (!from) return false;
  return !placesShareMetro(from, ret);
}

function legArrivesHome(leg: TransportLegDraft, returnCity: string): boolean {
  const ret = returnCity.trim();
  if (!ret) return false;
  const to = leg.toCity.trim();
  if (!to) return false;
  return placesShareMetro(to, ret);
}

/** Last calendar day spent abroad — checkout morning or evening return departure, not home arrival. */
export function deriveLastAbroadDay(input: BoundsInput): string | null {
  const abroadDates: string[] = [];
  const returnCity = input.returnCity?.trim() ?? "";

  for (const stay of input.accommodationStays ?? []) {
    if (!stay.name?.trim()) continue;
    if (isMeaningfulDate(stay.checkOutDate)) {
      abroadDates.push(stay.checkOutDate);
    }
    if (isMeaningfulDate(stay.checkInDate)) {
      abroadDates.push(addDays(stay.checkOutDate, -1));
    }
  }

  const returnFirst = primaryReturnLeg(input.returnLegs ?? []);
  if (returnFirst && isMeaningfulDate(returnFirst.travelDate)) {
    abroadDates.push(returnFirst.travelDate);
  }

  for (const leg of input.intercityLegs ?? []) {
    const dep = leg.travelDate?.trim() ?? "";
    if (!isMeaningfulDate(dep)) continue;
    if (returnCity && legArrivesHome(leg, returnCity) && !legDepartsFromAbroad(leg, returnCity)) {
      continue;
    }
    if (!returnCity || legDepartsFromAbroad(leg, returnCity)) {
      abroadDates.push(dep);
    }
  }

  if (!abroadDates.length) return null;
  return [...abroadDates].sort().at(-1)!;
}

function deriveFirstTripDay(input: BoundsInput): string | null {
  const dates: string[] = [];

  for (const stay of input.accommodationStays ?? []) {
    if (!stay.name?.trim()) continue;
    if (isMeaningfulDate(stay.checkInDate)) dates.push(stay.checkInDate);
  }

  for (const leg of allLegs(input)) {
    if (isMeaningfulDate(leg.travelDate)) dates.push(leg.travelDate);
  }

  for (const activity of input.activities ?? []) {
    if (isMeaningfulDate(activity.date)) dates.push(activity.date);
  }

  for (const day of input.dayPlaces ?? []) {
    if (day.dayType === "buffer") continue;
    if (day.primaryCity.trim() || day.secondaryCity?.trim()) {
      if (isMeaningfulDate(day.date)) dates.push(day.date);
    }
  }

  if (!dates.length) return null;
  return [...dates].sort()[0]!;
}

/** Home landing date from the final return leg, when it lands after endDate. */
export function deriveHomeArrivalDay(
  input: BoundsInput,
  endDate: string,
): string | null {
  const returnCity = input.returnCity?.trim() ?? "";
  const final = finalReturnLeg(input.returnLegs ?? []);
  if (final && returnCity && legArrivesHome(final, returnCity)) {
    const arr = arrivalDate(final);
    if (isMeaningfulDate(arr) && arr > endDate) return arr;
  }

  for (const leg of allLegs(input)) {
    if (!returnCity || !legArrivesHome(leg, returnCity)) continue;
    const arr = arrivalDate(leg);
    if (isMeaningfulDate(arr) && arr > endDate) {
      return arr;
    }
  }

  return null;
}

function deriveLastPaintedDay(input: BoundsInput): string | null {
  const returnCity = input.returnCity?.trim() ?? "";
  const dates: string[] = [];

  for (const day of input.dayPlaces ?? []) {
    if (day.dayType === "buffer") continue;
    if (!day.primaryCity.trim() && !day.secondaryCity?.trim()) continue;
    if (returnCity && locationsMatch(day.primaryCity, returnCity) && !day.secondaryCity?.trim()) {
      continue;
    }
    dates.push(day.date);
  }

  if (!dates.length) return null;
  return [...dates].sort().at(-1)!;
}

function hasStructuredTripContent(input: BoundsInput): boolean {
  const namedStays = (input.accommodationStays ?? []).some((s) => s.name?.trim());
  const transport = allLegs(input).some((leg) => leg.travelDate?.trim());
  return namedStays || transport;
}

/** Infer trip span from current named stays, transport, activities, and painted days. */
export function deriveTripBoundsFromContent(input: BoundsInput): TripBoundsFromContent | null {
  const startDate = deriveFirstTripDay(input);
  const lastAbroad = deriveLastAbroadDay(input);
  const lastPainted = !hasStructuredTripContent(input) ? deriveLastPaintedDay(input) : null;

  if (!startDate && !lastAbroad && !lastPainted) return null;

  const endDate = lastAbroad ?? lastPainted ?? startDate;
  if (!startDate) return { startDate: endDate!, endDate: endDate! };

  return {
    startDate,
    endDate: endDate && endDate >= startDate ? endDate : startDate,
  };
}
