import { DateTime } from "luxon";

import { isAirportPlace, placesShareMetro } from "@/lib/geo/airport-codes";
import {
  coalesceAdjacentNamedStays,
  effectiveHotelBandStart,
  stayCityLabel,
} from "@/lib/host/setup/accommodation-calendar";
import {
  ensurePostTripHomeBuffer,
  postTripHomeBufferDate,
} from "@/lib/host/setup/home-locks";
import { deriveHomeArrivalDay } from "@/lib/host/setup/derive-trip-bounds";
import { allPlaneLegsFromState } from "@/lib/host/setup/infer-flight-calendar";
import { metroDisplayLabel } from "@/lib/host/setup/metro-display";
import { tripDatesAreUnset } from "@/lib/host/trip-date-display";
import {
  inferStaysFromDayPlaces,
  locationsMatch,
  type LocationStayDraft,
} from "@/lib/host/wizard/location-stays";
import type {
  AccommodationStayDraft,
  DayPlaceDraft,
  TransportLegDraft,
} from "@/lib/host/wizard/types";

function addDays(iso: string, delta: number): string {
  const d = DateTime.fromISO(iso);
  return d.plus({ days: delta }).toISODate()!;
}

export function shortCityName(location: string): string {
  return location.split(",")[0]?.trim() || location.trim();
}

function ordinalDay(dt: DateTime): string {
  const day = dt.day;
  const mod100 = day % 100;
  const suffix =
    mod100 >= 11 && mod100 <= 13
      ? "th"
      : day % 10 === 1
        ? "st"
        : day % 10 === 2
          ? "nd"
          : day % 10 === 3
            ? "rd"
            : "th";
  return `${day}${suffix}`;
}

/** e.g. "Patong · 23rd – 31st Aug 2026" or "Patong · 24 Aug" for a single day. */
export function formatLocationStayRange(stay: LocationStayDraft): string {
  const city = shortCityName(stay.location);
  const start = DateTime.fromISO(stay.startDate);
  const end = DateTime.fromISO(stay.endDate);
  if (!start.isValid || !end.isValid) {
    return `${city} · ${stay.startDate}${stay.endDate !== stay.startDate ? ` – ${stay.endDate}` : ""}`;
  }

  if (stay.startDate === stay.endDate) {
    return `${city} · ${ordinalDay(start)} ${start.toFormat("MMM yyyy")}`;
  }

  if (start.year === end.year && start.month === end.month) {
    return `${city} · ${ordinalDay(start)} – ${ordinalDay(end)} ${end.toFormat("MMM yyyy")}`;
  }

  if (start.year === end.year) {
    return `${city} · ${ordinalDay(start)} ${start.toFormat("MMM")} – ${ordinalDay(end)} ${end.toFormat("MMM yyyy")}`;
  }

  return `${city} · ${ordinalDay(start)} ${start.toFormat("MMM yyyy")} – ${ordinalDay(end)} ${end.toFormat("MMM yyyy")}`;
}

export function locationRangesFromDays(input: {
  days: DayPlaceDraft[];
  tripStart: string;
  tripEnd: string;
  departureCity?: string;
  returnCity?: string;
  hasReturnTransport?: boolean;
  homeArrivalDate?: string | null;
}): LocationStayDraft[] {
  const painted = input.days.filter((d) => d.primaryCity.trim() || d.secondaryCity?.trim());
  if (!painted.length) return [];

  const sortedDates = [...painted].map((d) => d.date).sort();
  const start = tripDatesAreUnset(input.tripStart, input.tripEnd)
    ? sortedDates[0]!
    : input.tripStart;
  const end = tripDatesAreUnset(input.tripStart, input.tripEnd)
    ? sortedDates[sortedDates.length - 1]!
    : input.tripEnd;

  return mergeAdjacentSameCityRanges(
    inferStaysFromDayPlaces(
      input.days,
      start,
      end,
      input.departureCity ?? "",
      input.returnCity ?? "",
    ).concat(postTripHomeRange(input)),
  );
}

function rangeOverlapsNamedStay(
  range: LocationStayDraft,
  stay: LocationStayDraft,
): boolean {
  if (
    !locationsMatch(range.location, stay.location) &&
    !placesShareMetro(range.location, stay.location)
  ) {
    return false;
  }
  return range.startDate <= stay.endDate && range.endDate >= stay.startDate;
}

function namedStayRanges(
  stays: AccommodationStayDraft[],
  planeLegs: TransportLegDraft[],
): LocationStayDraft[] {
  return coalesceAdjacentNamedStays(stays)
    .filter((stay) => stay.name?.trim())
    .map((stay) => ({
      location: stayCityLabel(stay),
      startDate: effectiveHotelBandStart(stay, planeLegs),
      endDate: stay.checkOutDate,
    }))
    .filter((range) => range.location.trim() && !isAirportPlace(range.location));
}

/** Prefer hotel check-in nights; supplement with dayPlaces for home edges and gaps. */
export function locationRangesFromContent(input: {
  days: DayPlaceDraft[];
  tripStart: string;
  tripEnd: string;
  departureCity?: string;
  returnCity?: string;
  hasReturnTransport?: boolean;
  accommodationStays?: AccommodationStayDraft[];
  outboundLegs?: TransportLegDraft[];
  returnLegs?: TransportLegDraft[];
  intercityLegs?: TransportLegDraft[];
}): LocationStayDraft[] {
  const planeLegs = allPlaneLegsFromState({
    outboundLegs: input.outboundLegs ?? [],
    returnLegs: input.returnLegs ?? [],
    intercityLegs: input.intercityLegs ?? [],
  });
  const named = namedStayRanges(input.accommodationStays ?? [], planeLegs);

  if (!named.length) {
    return locationRangesFromDays(input);
  }

  const homeArrival = deriveHomeArrivalDay(
    {
      returnLegs: input.returnLegs,
      returnCity: input.returnCity,
    },
    input.tripEnd,
  );
  const fromDays = locationRangesFromDays({
    ...input,
    homeArrivalDate: homeArrival,
  }).filter((range) => {
    if (isAirportPlace(range.location)) return false;
    const supersededByStay = named.some((stay) => {
      if (
        !locationsMatch(range.location, stay.location) &&
        !placesShareMetro(range.location, stay.location)
      ) {
        return false;
      }
      if (range.startDate < stay.startDate) return true;
      return rangeOverlapsNamedStay(range, stay);
    });
    return !supersededByStay;
  });

  return mergeAdjacentSameCityRanges([...named, ...fromDays]);
}

function sameCityRangesMergeable(
  left: LocationStayDraft,
  right: LocationStayDraft,
): boolean {
  if (!locationsMatch(left.location, right.location)) return false;
  return (
    left.startDate <= addDays(right.endDate, 1) && right.startDate <= addDays(left.endDate, 1)
  );
}

function mergeSameCityRanges(
  left: LocationStayDraft,
  right: LocationStayDraft,
): LocationStayDraft {
  return {
    location: left.location,
    startDate: left.startDate < right.startDate ? left.startDate : right.startDate,
    endDate: left.endDate > right.endDate ? left.endDate : right.endDate,
  };
}

function mergeAdjacentSameCityRanges(ranges: LocationStayDraft[]): LocationStayDraft[] {
  const sorted = [...ranges].sort((a, b) => a.startDate.localeCompare(b.startDate));
  const merged: LocationStayDraft[] = [];

  for (const range of sorted) {
    const prev = merged[merged.length - 1];
    if (prev && sameCityRangesMergeable(prev, range)) {
      merged[merged.length - 1] = mergeSameCityRanges(prev, range);
      continue;
    }
    merged.push(range);
  }

  return merged;
}

function postTripHomeRange(input: {
  days: DayPlaceDraft[];
  tripStart: string;
  tripEnd: string;
  departureCity?: string;
  returnCity?: string;
  hasReturnTransport?: boolean;
  homeArrivalDate?: string | null;
}): LocationStayDraft[] {
  const ret = input.returnCity?.trim();
  if (!ret || tripDatesAreUnset(input.tripStart, input.tripEnd) || !input.hasReturnTransport) {
    return [];
  }

  const homeDay = postTripHomeBufferDate(input.tripEnd, input.homeArrivalDate);
  const buffered = ensurePostTripHomeBuffer(
    input.days,
    {
      startDate: input.tripStart,
      endDate: input.tripEnd,
      departureCity: input.departureCity ?? "",
      returnCity: ret,
    },
    true,
    input.homeArrivalDate,
  );
  const homePlace = buffered.find((d) => d.date === homeDay);
  if (!homePlace?.primaryCity.trim() || !locationsMatch(homePlace.primaryCity, ret)) return [];

  const homeLabel = metroDisplayLabel(ret) || ret;
  return [{ location: homeLabel, startDate: homeDay, endDate: homeDay }];
}
