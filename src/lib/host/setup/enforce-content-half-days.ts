import { stayCityLabel } from "@/lib/host/setup/accommodation-calendar";
import {
  groupAccommodationStays,
  mainAccommodationStays,
} from "@/lib/host/setup/entity-scope";
import { fillAccommodationInteriorGaps } from "@/lib/host/setup/fill-accommodation-gaps";
import { isLocationCrossover, type TripPlaceContext } from "@/lib/host/setup/home-locks";
import {
  addDays,
  DEFAULT_HALF_SHARE,
  inferStaysFromDayPlaces,
  locationsMatch,
} from "@/lib/host/wizard/location-stays";
import type { AccommodationStayDraft, DayPlaceDraft } from "@/lib/host/wizard/types";

import type { TripSetupState } from "./types";

type ContentSpan = { city: string; checkIn: string; checkOut: string };

function isHomeMarginDay(day: DayPlaceDraft, trip: TripPlaceContext): boolean {
  if (day.dayType === "buffer") return true;
  const dep = trip.departureCity.trim();
  const ret = trip.returnCity.trim();
  const primary = day.primaryCity.trim();
  const secondary = day.secondaryCity?.trim() ?? "";

  if (day.date === trip.startDate && dep && primary && locationsMatch(primary, dep) && !secondary) {
    return true;
  }
  if (day.date === addDays(trip.startDate, -1) && dep && primary && locationsMatch(primary, dep)) {
    return true;
  }
  if (day.date === trip.endDate && ret) {
    if (primary && locationsMatch(primary, ret) && !secondary) return true;
    if (secondary && locationsMatch(secondary, ret) && !primary) return true;
  }
  if (day.date > trip.endDate && ret && primary && locationsMatch(primary, ret)) {
    return true;
  }
  return false;
}

function accommodationSpans(stays: AccommodationStayDraft[]): ContentSpan[] {
  return stays
    .filter((s) => s.name?.trim())
    .map((s) => ({
      city: stayCityLabel(s),
      checkIn: s.checkInDate,
      checkOut: s.checkOutDate,
    }))
    .filter((s) => s.city);
}

function locationSpans(
  dayPlaces: DayPlaceDraft[],
  trip: TripPlaceContext,
): ContentSpan[] {
  return inferStaysFromDayPlaces(
    dayPlaces,
    trip.startDate,
    trip.endDate,
    trip.departureCity,
    trip.returnCity,
  ).map((stay) => ({
    city: stay.location,
    checkIn: stay.startDate,
    checkOut: addDays(stay.endDate, 1),
  }));
}

function enforceArrivalHalf(day: DayPlaceDraft, city: string, trip: TripPlaceContext): DayPlaceDraft {
  if (isHomeMarginDay(day, trip) || isLocationCrossover(day, trip)) return day;

  const primary = day.primaryCity.trim();
  const secondary = day.secondaryCity?.trim() ?? "";
  const share = day.primaryShare ?? 1;

  if (!primary && secondary && locationsMatch(secondary, city) && share < 1) return day;

  if (primary && !locationsMatch(primary, city) && share < 1) {
    return {
      ...day,
      secondaryCity: city,
      primaryShare: DEFAULT_HALF_SHARE,
      dayType: day.dayType === "buffer" ? "buffer" : "trip",
    };
  }

  if (primary && locationsMatch(primary, city) && !secondary && share >= 0.99) {
    return {
      ...day,
      primaryCity: "",
      secondaryCity: city,
      primaryShare: DEFAULT_HALF_SHARE,
      dayType: day.dayType === "buffer" ? "buffer" : "trip",
    };
  }

  if (
    primary &&
    secondary &&
    locationsMatch(primary, city) &&
    locationsMatch(secondary, city)
  ) {
    return {
      ...day,
      primaryCity: "",
      secondaryCity: city,
      primaryShare: DEFAULT_HALF_SHARE,
      dayType: day.dayType === "buffer" ? "buffer" : "trip",
    };
  }

  return day;
}

function enforceDepartureHalf(day: DayPlaceDraft, city: string, trip: TripPlaceContext): DayPlaceDraft {
  if (isHomeMarginDay(day, trip) || isLocationCrossover(day, trip)) return day;

  const primary = day.primaryCity.trim();
  const secondary = day.secondaryCity?.trim() ?? "";
  const share = day.primaryShare ?? 1;

  if (primary && locationsMatch(primary, city) && !secondary && share < 1) return day;

  if (primary && locationsMatch(primary, city) && !secondary && share >= 0.99) {
    return {
      ...day,
      primaryShare: DEFAULT_HALF_SHARE,
      dayType: day.dayType === "buffer" ? "buffer" : "trip",
    };
  }

  if (
    primary &&
    secondary &&
    locationsMatch(primary, city) &&
    locationsMatch(secondary, city)
  ) {
    return {
      ...day,
      primaryCity: city,
      secondaryCity: null,
      primaryShare: DEFAULT_HALF_SHARE,
      dayType: day.dayType === "buffer" ? "buffer" : "trip",
    };
  }

  return day;
}

function enforceInteriorFull(day: DayPlaceDraft, city: string, trip: TripPlaceContext): DayPlaceDraft {
  if (isHomeMarginDay(day, trip) || isLocationCrossover(day, trip)) return day;

  const primary = day.primaryCity.trim();
  const secondary = day.secondaryCity?.trim() ?? "";
  if (primary && secondary && !locationsMatch(primary, secondary)) return day;

  if (primary && locationsMatch(primary, city)) {
    return {
      ...day,
      primaryCity: city,
      secondaryCity: null,
      primaryShare: 1,
      dayType: day.dayType === "buffer" ? "buffer" : "trip",
    };
  }
  if (!primary && secondary && locationsMatch(secondary, city)) {
    return {
      ...day,
      primaryCity: city,
      secondaryCity: null,
      primaryShare: 1,
      dayType: day.dayType === "buffer" ? "buffer" : "trip",
    };
  }
  return day;
}

function enforceLastNightHalf(day: DayPlaceDraft, city: string, trip: TripPlaceContext): DayPlaceDraft {
  if (isHomeMarginDay(day, trip) || isLocationCrossover(day, trip)) return day;

  const primary = day.primaryCity.trim();
  const secondary = day.secondaryCity?.trim() ?? "";
  const share = day.primaryShare ?? 1;

  if (!primary && secondary && locationsMatch(secondary, city) && share < 1) return day;

  if (
    (primary && locationsMatch(primary, city)) ||
    (secondary && locationsMatch(secondary, city))
  ) {
    return {
      ...day,
      primaryCity: city,
      secondaryCity: null,
      primaryShare: DEFAULT_HALF_SHARE,
      dayType: day.dayType === "buffer" ? "buffer" : "trip",
    };
  }

  return day;
}

function ensureDay(byDate: Map<string, DayPlaceDraft>, date: string): DayPlaceDraft {
  const existing = byDate.get(date);
  if (existing) return existing;
  const created: DayPlaceDraft = {
    date,
    primaryCity: "",
    secondaryCity: null,
    primaryShare: 1,
    dayType: "trip",
    includeBuffer: false,
  };
  byDate.set(date, created);
  return created;
}

function applyAccommodationSpanToDays(
  byDate: Map<string, DayPlaceDraft>,
  span: ContentSpan,
  trip: TripPlaceContext,
): void {
  const lastNight = addDays(span.checkOut, -1);
  if (span.checkIn > lastNight) return;

  let cursor = span.checkIn;
  while (cursor <= span.checkOut) {
    ensureDay(byDate, cursor);
    cursor = addDays(cursor, 1);
  }

  const checkInDay = byDate.get(span.checkIn)!;
  byDate.set(span.checkIn, enforceArrivalHalf(checkInDay, span.city, trip));

  const checkOutDay = byDate.get(span.checkOut)!;
  byDate.set(span.checkOut, enforceDepartureHalf(checkOutDay, span.city, trip));

  cursor = addDays(span.checkIn, 1);
  while (cursor <= lastNight) {
    const day = byDate.get(cursor)!;
    byDate.set(cursor, enforceInteriorFull(day, span.city, trip));
    cursor = addDays(cursor, 1);
  }
}

function applyLocationSpanToDays(
  byDate: Map<string, DayPlaceDraft>,
  span: ContentSpan,
  trip: TripPlaceContext,
): void {
  const lastNight = addDays(span.checkOut, -1);
  if (span.checkIn > lastNight) return;

  const checkInDay = byDate.get(span.checkIn);
  if (checkInDay) {
    byDate.set(span.checkIn, enforceArrivalHalf(checkInDay, span.city, trip));
  }

  const checkOutDay = byDate.get(span.checkOut);
  if (checkOutDay) {
    byDate.set(span.checkOut, enforceDepartureHalf(checkOutDay, span.city, trip));
  }

  let cursor = addDays(span.checkIn, 1);
  while (cursor < lastNight) {
    const day = byDate.get(cursor);
    if (day) byDate.set(cursor, enforceInteriorFull(day, span.city, trip));
    cursor = addDays(cursor, 1);
  }

  if (lastNight > span.checkIn) {
    const lastNightDay = byDate.get(lastNight);
    if (lastNightDay) {
      const primary = lastNightDay.primaryCity.trim();
      const secondary = lastNightDay.secondaryCity?.trim() ?? "";
      const share = lastNightDay.primaryShare ?? 1;
      const isCrossover = Boolean(primary && secondary && !locationsMatch(primary, secondary));
      const isFullSingleCity =
        share >= 0.99 &&
        ((primary && locationsMatch(primary, span.city) && !secondary) ||
          (!primary && secondary && locationsMatch(secondary, span.city)));
      if (!isCrossover && isFullSingleCity) {
        byDate.set(lastNight, enforceLastNightHalf(lastNightDay, span.city, trip));
      }
    }
  }
}

/** Every location and named stay must start/end on a half-day — except home margin cities. */
export function enforceContentHalfDayBoundaries(
  dayPlaces: DayPlaceDraft[],
  trip: TripPlaceContext,
  accommodationStays: AccommodationStayDraft[],
): DayPlaceDraft[] {
  const named = accommodationStays.filter((s) => s.name?.trim());
  const filled = fillAccommodationInteriorGaps(dayPlaces, named);
  const byDate = new Map(filled.map((d) => [d.date, d]));

  for (const span of accommodationSpans(named)) {
    applyAccommodationSpanToDays(byDate, span, trip);
  }

  for (const span of locationSpans([...byDate.values()], trip)) {
    applyLocationSpanToDays(byDate, span, trip);
  }

  return [...byDate.values()]
    .filter((d) => d.primaryCity.trim() || d.secondaryCity?.trim())
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function enforceGroupHalfDayBoundaries(
  state: TripSetupState,
  groupId: string,
): TripSetupState {
  const trip: TripPlaceContext = {
    startDate: state.basics.startDate,
    endDate: state.basics.endDate,
    departureCity: state.basics.departureCity,
    returnCity: state.basics.returnCity,
  };
  const stays =
    groupId === state.mainGroupId
      ? mainAccommodationStays(state)
      : groupAccommodationStays(state, groupId);
  const dayPlaces = state.dayPlacesByGroupId[groupId] ?? [];
  const enforced = enforceContentHalfDayBoundaries(dayPlaces, trip, stays);

  return {
    ...state,
    dayPlacesByGroupId: {
      ...state.dayPlacesByGroupId,
      [groupId]: enforced,
    },
  };
}
