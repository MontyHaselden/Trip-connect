import { isAirportPlace } from "@/lib/geo/airport-codes";
import { metroDisplayLabel } from "@/lib/host/setup/metro-display";
import { enforceHomeLocks } from "@/lib/host/setup/home-locks";
import type { DayPlaceDraft } from "./types";

export type LocationStayDraft = {
  location: string;
  startDate: string;
  endDate: string;
};

export const DEFAULT_HALF_SHARE = 0.5;

/** Calendar days are full (1) or half (0.5) only — no thirds or quarters. */
export function normalizeDayShare(share: number | null | undefined): number {
  if (share == null || share >= 0.75) return 1;
  return DEFAULT_HALF_SHARE;
}

export type HalfSide = "left" | "right";

/** Which half of the day is still free to paint a location. */
export function getEmptyHalf(
  day: Pick<DayPlaceDraft, "primaryCity" | "secondaryCity" | "primaryShare">,
): HalfSide | null {
  const primary = day.primaryCity.trim();
  const secondary = day.secondaryCity?.trim() ?? "";
  const share = day.primaryShare ?? 1;

  if (primary && !secondary && share < 1) return "right";
  if (!primary && secondary && share < 1) return "left";
  return null;
}

export function isSplitDay(day: DayPlaceDraft | null | undefined): boolean {
  if (!day) return false;
  const share = day.primaryShare ?? 1;
  const primary = day.primaryCity.trim();
  const secondary = day.secondaryCity?.trim() ?? "";
  return share < 1 || Boolean(primary && secondary);
}

export function halfFromClickX(
  clientX: number,
  rect: Pick<DOMRect, "left" | "width">,
  day: DayPlaceDraft,
): HalfSide {
  const ratio = (clientX - rect.left) / rect.width;
  const share = day.primaryShare ?? 1;
  const divider = share < 1 || Boolean(day.secondaryCity?.trim()) ? share : 0.5;
  return ratio < divider ? "left" : "right";
}

export function isHalfEmpty(day: DayPlaceDraft, half: HalfSide): boolean {
  return getEmptyHalf(day) === half;
}

export function cityOnHalf(day: DayPlaceDraft, half: HalfSide): string {
  const primary = day.primaryCity.trim();
  const secondary = day.secondaryCity?.trim() ?? "";
  const share = day.primaryShare ?? 1;
  if (half === "left") return primary;
  if (secondary) return secondary;
  if (primary && share < 1) return "";
  return primary;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Hard cap so corrupt trip dates cannot freeze the browser building day arrays. */
export const MAX_DATE_ENUMERATION_DAYS = 800;

export function addDays(iso: string, delta: number): string {
  const trimmed = iso.trim();
  if (!ISO_DATE.test(trimmed)) return trimmed;
  const d = new Date(`${trimmed}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return trimmed;
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

export function enumerateDates(start: string, end: string): string[] {
  if (!start || !end || start > end) return [];
  const out: string[] = [];
  let cur = start;
  while (cur <= end && out.length < MAX_DATE_ENUMERATION_DAYS) {
    out.push(cur);
    const next = addDays(cur, 1);
    if (next <= cur) break;
    cur = next;
  }
  return out;
}

function isArrivalDay(
  date: string,
  stay: LocationStayDraft,
  flightArrivalDates?: Set<string>,
): boolean {
  return (
    date === stay.startDate &&
    stay.startDate !== stay.endDate &&
    Boolean(flightArrivalDates?.has(date))
  );
}

function isDepartureDay(
  date: string,
  stay: LocationStayDraft,
  flightDepartureDates?: Set<string>,
): boolean {
  return (
    date === stay.endDate &&
    stay.startDate !== stay.endDate &&
    Boolean(flightDepartureDates?.has(date))
  );
}

function cityOnDay(day: DayPlaceDraft, location: string): boolean {
  const loc = location.trim().toLowerCase();
  return (
    day.primaryCity.trim().toLowerCase() === loc ||
    (day.secondaryCity?.trim().toLowerCase() ?? "") === loc
  );
}

function fillEmptyHalf(day: DayPlaceDraft, location: string, half: HalfSide): void {
  const loc = location.trim();
  if (half === "right") {
    day.secondaryCity = loc;
  } else {
    day.primaryCity = loc;
  }
  day.primaryShare = DEFAULT_HALF_SHARE;
  day.dayType = "travel";
}

function isMultiDayStayEnd(
  date: string,
  stay: LocationStayDraft,
  flightDepartureDates?: Set<string>,
): boolean {
  if (stay.startDate === stay.endDate) return false;
  if (date !== stay.endDate) return false;
  return !isDepartureDay(date, stay, flightDepartureDates);
}

/** Previous day already carries the stay boundary — start on a full day (divider on prev day). */
function prevDayRequiresFullStayStart(
  prevDay: DayPlaceDraft | undefined,
  location: string,
): boolean {
  if (!prevDay || prevDay.dayType === "buffer") return false;
  const loc = location.trim().toLowerCase();
  const primary = prevDay.primaryCity.trim();
  const secondary = prevDay.secondaryCity?.trim() ?? "";
  const share = prevDay.primaryShare ?? 1;
  if (primary && !secondary && share < 1) return true;
  if (primary.toLowerCase() === loc && !secondary && share >= 1) return true;
  if (primary.toLowerCase() === loc && secondary && share < 1) return true;
  if (secondary.toLowerCase() === loc && primary && share < 1) return true;
  return false;
}

function isMultiDayStayStart(
  date: string,
  stay: LocationStayDraft,
  prevDay: DayPlaceDraft | undefined,
  flightArrivalDates?: Set<string>,
): boolean {
  if (stay.startDate === stay.endDate) return false;
  if (date !== stay.startDate) return false;
  if (isArrivalDay(date, stay, flightArrivalDates)) return false;
  return !prevDayRequiresFullStayStart(prevDay, stay.location);
}

function applyStayToDay(
  day: DayPlaceDraft,
  date: string,
  location: string,
  stay: LocationStayDraft,
  tripStart: string,
  tripEnd: string,
  travelPaintStart?: number,
  flightDepartureDates?: Set<string>,
  flightArrivalDates?: Set<string>,
  prevDay?: DayPlaceDraft,
): void {
  const loc = location.trim();
  const existingPrimary = day.primaryCity.trim();
  const existingSecondary = day.secondaryCity?.trim() ?? "";

  if (isArrivalDay(date, stay, flightArrivalDates) && !existingPrimary && !existingSecondary) {
    const arrivalShare = travelPaintStart ?? DEFAULT_HALF_SHARE;
    day.primaryCity = "";
    day.secondaryCity = loc;
    day.primaryShare = arrivalShare;
    day.dayType = "travel";
    return;
  }

  if (isDepartureDay(date, stay, flightDepartureDates) && !existingPrimary) {
    day.primaryCity = loc;
    day.secondaryCity = existingSecondary || null;
    day.primaryShare = DEFAULT_HALF_SHARE;
    day.dayType = existingSecondary ? "travel" : "trip";
    return;
  }

  if (stay.startDate === stay.endDate && !existingPrimary && !existingSecondary) {
    if (travelPaintStart && travelPaintStart > 0 && travelPaintStart < 1) {
      day.primaryCity = "";
      day.secondaryCity = loc;
      day.primaryShare = travelPaintStart;
      day.dayType = "travel";
      return;
    }
    day.primaryCity = loc;
    day.secondaryCity = null;
    day.primaryShare = 1;
    day.dayType = "trip";
    return;
  }

  if (
    isMultiDayStayEnd(date, stay, flightDepartureDates) &&
    !existingPrimary &&
    !existingSecondary
  ) {
    day.primaryCity = loc;
    day.secondaryCity = null;
    day.primaryShare = DEFAULT_HALF_SHARE;
    day.dayType = date === tripEnd ? "return" : "trip";
    return;
  }

  if (
    isMultiDayStayStart(date, stay, prevDay, flightArrivalDates) &&
    !existingPrimary &&
    !existingSecondary
  ) {
    day.primaryCity = "";
    day.secondaryCity = loc;
    day.primaryShare = travelPaintStart ?? DEFAULT_HALF_SHARE;
    day.dayType = "travel";
    return;
  }

  if (!existingPrimary && !existingSecondary) {
    day.primaryCity = loc;
    day.secondaryCity = null;
    day.primaryShare = 1;
    day.dayType = "trip";
    return;
  }

  if (existingPrimary.toLowerCase() === loc.toLowerCase()) {
    if (isDepartureDay(date, stay, flightDepartureDates)) {
      day.primaryShare = DEFAULT_HALF_SHARE;
    } else if (isMultiDayStayEnd(date, stay, flightDepartureDates)) {
      day.primaryShare = DEFAULT_HALF_SHARE;
    } else if (!isArrivalDay(date, stay, flightArrivalDates)) {
      day.primaryShare = 1;
    }
    return;
  }

  if (existingSecondary.toLowerCase() === loc.toLowerCase()) {
    return;
  }

  const emptyHalf = getEmptyHalf(day);
  if (emptyHalf && !cityOnDay(day, loc)) {
    fillEmptyHalf(day, loc, emptyHalf);
    if (date === tripEnd) day.dayType = "return";
    return;
  }

  if (isArrivalDay(date, stay, flightArrivalDates) && !existingSecondary) {
    day.secondaryCity = loc;
    day.primaryShare = travelPaintStart ?? DEFAULT_HALF_SHARE;
    day.dayType = "travel";
    return;
  }

  day.secondaryCity = loc;
  day.primaryShare = DEFAULT_HALF_SHARE;
  day.dayType = "travel";

  if (date === tripEnd) day.dayType = "return";
  else if (date === tripStart) day.dayType = "travel";
}

function cloneDay(day: DayPlaceDraft): DayPlaceDraft {
  return { ...day };
}

function dayMap(days: DayPlaceDraft[]): Map<string, DayPlaceDraft> {
  return new Map(days.map((d) => [d.date, cloneDay(d)]));
}

export function applyLocationStays(
  days: DayPlaceDraft[],
  stays: LocationStayDraft[],
  trip: { startDate: string; endDate: string; departureCity: string; returnCity: string },
  flightDepartureDates?: Set<string>,
  travelPaintStartByDate?: Map<string, number>,
  flightArrivalDates?: Set<string>,
  skipEndHomeLock?: boolean,
): DayPlaceDraft[] {
  const map = dayMap(days);
  const bufferBefore = addDays(trip.startDate, -1);

  for (const day of map.values()) {
    if (day.date === bufferBefore && trip.departureCity.trim()) {
      day.primaryCity = trip.departureCity.trim();
      day.secondaryCity = null;
      day.primaryShare = 1;
      day.dayType = "buffer";
    } else if (day.date > trip.endDate && day.dayType === "buffer") {
      if (flightArrivalDates?.has(day.date)) {
        day.primaryCity = "";
        day.secondaryCity = null;
        day.primaryShare = 1;
      } else if (trip.returnCity.trim()) {
        day.primaryCity = trip.returnCity.trim();
        day.secondaryCity = null;
        day.primaryShare = 1;
      }
    } else if (
      day.date >= trip.startDate &&
      day.date <= trip.endDate &&
      day.dayType !== "buffer"
    ) {
      day.primaryCity = "";
      day.secondaryCity = null;
      day.primaryShare = 1;
      day.dayType = day.date === trip.endDate ? "return" : "trip";
    }
  }

  for (const stay of stays) {
    const location = stay.location.trim();
    if (!location) continue;

    for (const date of enumerateDates(stay.startDate, stay.endDate)) {
      const day = map.get(date);
      if (!day || day.dayType === "buffer") continue;

      applyStayToDay(
        day,
        date,
        location,
        stay,
        trip.startDate,
        trip.endDate,
        travelPaintStartByDate?.get(date),
        flightDepartureDates,
        flightArrivalDates,
        map.get(addDays(date, -1)),
      );
    }
  }

  const sorted = [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
  return enforceHomeLocks(
    sorted,
    trip,
    flightDepartureDates,
    flightArrivalDates,
    skipEndHomeLock,
  );
}

function pushStay(stays: LocationStayDraft[], stay: LocationStayDraft | null): LocationStayDraft | null {
  if (stay) stays.push(stay);
  return null;
}

function extendOrStartStay(
  stays: LocationStayDraft[],
  current: LocationStayDraft | null,
  city: string,
  date: string,
): LocationStayDraft {
  if (current && current.location.toLowerCase() === city.toLowerCase()) {
    current.endDate = date;
    return current;
  }
  current = pushStay(stays, current);
  return { location: city, startDate: date, endDate: date };
}

function isHomeEdgeOnlyDay(
  day: DayPlaceDraft,
  tripStart: string,
  tripEnd: string,
  departureCity: string,
  returnCity: string,
): boolean {
  const primary = day.primaryCity.trim();
  const secondary = day.secondaryCity?.trim() ?? "";
  const dep = departureCity.trim().toLowerCase();
  const ret = returnCity.trim().toLowerCase();

  if (day.date === tripStart && dep && primary.toLowerCase() === dep && !secondary) {
    return true;
  }
  if (day.date === tripEnd && ret && primary.toLowerCase() === ret && !secondary) {
    return true;
  }
  if (day.date === tripEnd && ret && secondary.toLowerCase() === ret && !primary) {
    return true;
  }
  return false;
}

export function inferStaysFromDayPlaces(
  days: DayPlaceDraft[],
  tripStart: string,
  tripEnd: string,
  departureCity = "",
  returnCity = "",
): LocationStayDraft[] {
  const tripDays = days
    .filter(
      (d) =>
        d.date >= tripStart &&
        d.date <= tripEnd &&
        d.dayType !== "buffer" &&
        (d.primaryCity.trim() || d.secondaryCity?.trim()),
    )
    .sort((a, b) => a.date.localeCompare(b.date));

  const stays: LocationStayDraft[] = [];
  let current: LocationStayDraft | null = null;

  for (const day of tripDays) {
    if (isHomeEdgeOnlyDay(day, tripStart, tripEnd, departureCity, returnCity)) {
      current = pushStay(stays, current);
      continue;
    }

    const primary = day.primaryCity.trim();
    const secondary = day.secondaryCity?.trim() ?? "";
    const share = day.primaryShare ?? 1;
    const isHalf = share < 1;

    if (primary && secondary && isHalf) {
      if (!isAirportPlace(primary)) {
        current = extendOrStartStay(stays, current, primary, day.date);
      }
      current = pushStay(stays, current);
      if (!isAirportPlace(secondary)) {
        current = extendOrStartStay(stays, null, secondary, day.date);
      }
      continue;
    }

    if (primary && !secondary && isHalf) {
      if (!isAirportPlace(primary)) {
        current = extendOrStartStay(stays, current, primary, day.date);
      }
      current = pushStay(stays, current);
      continue;
    }

    if (!primary && secondary && isHalf) {
      if (!isAirportPlace(secondary)) {
        current = extendOrStartStay(stays, current, secondary, day.date);
      }
      continue;
    }

    const city = primary || secondary;
    if (!city || isAirportPlace(city)) continue;
    current = extendOrStartStay(stays, current, city, day.date);
  }

  pushStay(stays, current);
  return coalesceAdjacentStays(stays);
}

/** Prefer starting on the first half-empty day in range (paint the empty half). */
export function effectiveStayStart(
  rangeStart: string,
  rangeEnd: string,
  dayPlaces: DayPlaceDraft[],
): string {
  for (const date of enumerateDates(rangeStart, rangeEnd)) {
    const day = dayPlaces.find((d) => d.date === date);
    if (day && getEmptyHalf(day) === "right") return date;
  }
  return rangeStart;
}

export function locationsMatch(a: string, b: string): boolean {
  const left = a.trim().toLowerCase();
  const right = b.trim().toLowerCase();
  if (!left || !right) return false;
  if (left === right) return true;
  const leftCity = left.split(",")[0]?.trim() ?? left;
  const rightCity = right.split(",")[0]?.trim() ?? right;
  return leftCity === rightCity;
}

/** When painting next to an existing stay for the same city, extend it instead of adding another. */
export function findAdjacentStayToMerge(
  stays: LocationStayDraft[],
  location: string,
  startDate: string,
  endDate: string,
): { index: number; stay: LocationStayDraft } | null {
  for (let i = 0; i < stays.length; i++) {
    const stay = stays[i]!;
    if (!locationsMatch(stay.location, location)) continue;

    const touchesAfter = addDays(stay.endDate, 1) === startDate;
    const touchesBefore = addDays(endDate, 1) === stay.startDate;
    const sharesBoundary = stay.endDate === startDate || stay.startDate === endDate;
    const overlaps = startDate <= stay.endDate && endDate >= stay.startDate;

    if (touchesAfter || touchesBefore || sharesBoundary || overlaps) {
      return { index: i, stay };
    }
  }
  return null;
}

export function mergeStayRange(
  stays: LocationStayDraft[],
  index: number,
  startDate: string,
  endDate: string,
): LocationStayDraft[] {
  return stays.map((stay, i) => {
    if (i !== index) return stay;
    return {
      ...stay,
      startDate: startDate < stay.startDate ? startDate : stay.startDate,
      endDate: endDate > stay.endDate ? endDate : stay.endDate,
    };
  });
}

/** Merge consecutive stays for the same city (e.g. Kyoto 4–5 + Kyoto 6–10 → Kyoto 4–10). */
export function coalesceAdjacentStays(stays: LocationStayDraft[]): LocationStayDraft[] {
  if (stays.length <= 1) return stays;
  const sorted = [...stays].sort(
    (a, b) => a.startDate.localeCompare(b.startDate) || a.endDate.localeCompare(b.endDate),
  );
  const out: LocationStayDraft[] = [];

  for (const stay of sorted) {
    const last = out[out.length - 1];
    if (
      last &&
      locationsMatch(last.location, stay.location) &&
      addDays(last.endDate, 1) >= stay.startDate
    ) {
      if (stay.startDate < last.startDate) last.startDate = stay.startDate;
      if (stay.endDate > last.endDate) last.endDate = stay.endDate;
    } else {
      out.push({ ...stay });
    }
  }
  return out;
}

/** All same-city stays touching or overlapping a new range — absorb into one on confirm. */
export function findStaysToAbsorb(
  stays: LocationStayDraft[],
  location: string,
  startDate: string,
  endDate: string,
): number[] {
  const indices: number[] = [];
  for (let i = 0; i < stays.length; i++) {
    const stay = stays[i]!;
    if (!locationsMatch(stay.location, location)) continue;
    const touchesAfter = addDays(stay.endDate, 1) === startDate;
    const touchesBefore = addDays(endDate, 1) === stay.startDate;
    const sharesBoundary = stay.endDate === startDate || stay.startDate === endDate;
    const overlaps = startDate <= stay.endDate && endDate >= stay.startDate;
    if (touchesAfter || touchesBefore || sharesBoundary || overlaps) {
      indices.push(i);
    }
  }
  return indices;
}

export function mergeStaysWithNewRange(
  stays: LocationStayDraft[],
  location: string,
  startDate: string,
  endDate: string,
): LocationStayDraft[] {
  const absorbIndices = findStaysToAbsorb(stays, location, startDate, endDate);
  if (!absorbIndices.length) {
    return coalesceAdjacentStays([...stays, { location, startDate, endDate }]);
  }

  let mergedStart = startDate;
  let mergedEnd = endDate;
  for (const index of absorbIndices) {
    const stay = stays[index]!;
    if (stay.startDate < mergedStart) mergedStart = stay.startDate;
    if (stay.endDate > mergedEnd) mergedEnd = stay.endDate;
  }

  const absorbSet = new Set(absorbIndices);
  const rest = stays.filter((_, i) => !absorbSet.has(i));
  return coalesceAdjacentStays([...rest, { location, startDate: mergedStart, endDate: mergedEnd }]);
}

/** Preview the merged stay shown when confirming a range adjacent to existing same-city stays. */
export function previewStayMerge(
  stays: LocationStayDraft[],
  location: string,
  startDate: string,
  endDate: string,
): LocationStayDraft | null {
  const absorbIndices = findStaysToAbsorb(stays, location, startDate, endDate);
  if (!absorbIndices.length) return null;

  let mergedStart = startDate;
  let mergedEnd = endDate;
  for (const index of absorbIndices) {
    const stay = stays[index]!;
    if (stay.startDate < mergedStart) mergedStart = stay.startDate;
    if (stay.endDate > mergedEnd) mergedEnd = stay.endDate;
  }
  return { location, startDate: mergedStart, endDate: mergedEnd };
}

/** End overlapping stays on the crossover day when a new stay starts inside them. */
export function trimStaysForNewRange(
  stays: LocationStayDraft[],
  newLocation: string,
  rangeStart: string,
  dayPlaces: DayPlaceDraft[],
): LocationStayDraft[] {
  const loc = newLocation.trim().toLowerCase();
  const startDay = dayPlaces.find((d) => d.date === rangeStart);
  const paintEmptyRight = startDay && getEmptyHalf(startDay) === "right";

  return stays.map((stay) => {
    if (stay.location.trim().toLowerCase() === loc) return stay;
    if (rangeStart <= stay.startDate || rangeStart > stay.endDate) return stay;

    if (paintEmptyRight) {
      return { ...stay, endDate: rangeStart };
    }

    const dayBefore = addDays(rangeStart, -1);
    if (dayBefore < stay.startDate) return stay;
    return { ...stay, endDate: dayBefore };
  });
}

export type TripDayCoverageContext = {
  flightDepartureDates?: Set<string>;
  flightArrivalDates?: Set<string>;
  /** When set, blank days with a paintable stay slot count as uncovered. */
  hasPaintableStaySlot?: (date: string, day: DayPlaceDraft) => boolean;
  /** When set, blank days fully consumed by travel (no paintable slot) count as covered. */
  isTravelOnlyDay?: (date: string) => boolean;
};

function dayHasStayCoverage(
  day: DayPlaceDraft,
  date: string,
  ctx: TripDayCoverageContext = {},
): boolean {
  const emptyHalf = getEmptyHalf(day);
  if (emptyHalf && ctx.hasPaintableStaySlot?.(date, day)) return false;

  const primary = day.primaryCity.trim();
  const secondary = day.secondaryCity?.trim() ?? "";
  if (primary || secondary) {
    const share = day.primaryShare ?? 1;
    if (primary && secondary) return true;
    if (share >= 1) return true;
    if (emptyHalf && !ctx.hasPaintableStaySlot?.(date, day)) return true;
    return false;
  }

  if (ctx.hasPaintableStaySlot?.(date, day)) return false;
  if (ctx.isTravelOnlyDay?.(date)) return true;
  if (ctx.flightDepartureDates?.has(date)) return true;
  if (ctx.flightArrivalDates?.has(date)) return true;
  return false;
}

export function hasUncoveredTripDays(
  days: DayPlaceDraft[],
  tripStart: string,
  tripEnd: string,
  ctx: TripDayCoverageContext = {},
): boolean {
  return enumerateDates(tripStart, tripEnd).some((date) => {
    const day = days.find((d) => d.date === date);
    if (!day) return true;
    return !dayHasStayCoverage(day, date, ctx);
  });
}

const LOCATION_PALETTE = [
  { fill: "#e8edf8", accent: "#4f6b9a", text: "#1e2f52" },
  { fill: "#e4f2ec", accent: "#3d7a62", text: "#173d30" },
  { fill: "#f3e8f8", accent: "#7a4f9a", text: "#3b1f52" },
  { fill: "#f8f0e4", accent: "#9a7340", text: "#4a3618" },
  { fill: "#e8f4f8", accent: "#3d7a8a", text: "#173d47" },
  { fill: "#f8e8ec", accent: "#9a4f62", text: "#4a1f2a" },
  { fill: "#ece8f8", accent: "#5f4f9a", text: "#2a1f52" },
  { fill: "#eef4e4", accent: "#627a3d", text: "#2d3d17" },
  { fill: "#f8ece8", accent: "#9a5f4f", text: "#522a1f" },
  { fill: "#eef0f4", accent: "#5a6478", text: "#252a35" },
  { fill: "#e8f8f2", accent: "#3d9a7a", text: "#174a3d" },
  { fill: "#f8f4e8", accent: "#9a8a40", text: "#4a4218" },
] as const;

export const LOCATION_PALETTE_SIZE = LOCATION_PALETTE.length;

export type LocationPaletteSwatch = (typeof LOCATION_PALETTE)[number];

/** Stable palette bucket — "Bangkok" and "Bangkok, Thailand" share one color. */
export function locationPaletteKey(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "";
  if (isAirportPlace(trimmed)) {
    return metroDisplayLabel(trimmed).toLowerCase();
  }
  return (trimmed.split(",")[0]?.trim() || trimmed).toLowerCase();
}

function paletteIndex(name: string): number {
  const key = locationPaletteKey(name);
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = key.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % LOCATION_PALETTE.length;
}

function swatchForName(name: string): LocationPaletteSwatch {
  return LOCATION_PALETTE[paletteIndex(name)]!;
}

export type TripLocationColorSource = {
  days: Pick<DayPlaceDraft, "date" | "primaryCity" | "secondaryCity">[];
  departureCity?: string;
  returnCity?: string;
  segmentCities?: string[];
};

/** Unique trip locations in calendar order — used to avoid hash palette collisions. */
export function collectOrderedTripLocationNames(source: TripLocationColorSource): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];
  const add = (name: string | null | undefined) => {
    const trimmed = name?.trim();
    if (!trimmed) return;
    const key = locationPaletteKey(trimmed);
    if (!key || seen.has(key)) return;
    seen.add(key);
    ordered.push(trimmed);
  };

  add(source.departureCity);
  for (const day of [...source.days].sort((a, b) => a.date.localeCompare(b.date))) {
    add(day.primaryCity);
    add(day.secondaryCity);
  }
  for (const city of source.segmentCities ?? []) {
    add(city);
  }
  add(source.returnCity);
  return ordered;
}

/** Assign each trip location a distinct palette slot (wraps after palette size). */
export function buildTripLocationColorMap(
  locationNames: Iterable<string>,
): Map<string, LocationPaletteSwatch> {
  const map = new Map<string, LocationPaletteSwatch>();
  for (const name of locationNames) {
    const key = locationPaletteKey(name);
    if (!key || map.has(key)) continue;
    map.set(key, LOCATION_PALETTE[map.size % LOCATION_PALETTE.length]!);
  }
  return map;
}

export function tripLocationSwatch(
  name: string,
  colorMap?: Map<string, LocationPaletteSwatch>,
): LocationPaletteSwatch {
  const key = locationPaletteKey(name);
  if (key && colorMap?.has(key)) return colorMap.get(key)!;
  return swatchForName(name);
}

export function locationColor(name: string): string {
  return swatchForName(name).fill;
}

export function locationBorderColor(name: string): string {
  return swatchForName(name).accent;
}

export function locationTextColor(name: string): string {
  return swatchForName(name).text;
}

export function tripLocationColor(
  name: string,
  colorMap?: Map<string, LocationPaletteSwatch>,
): string {
  return tripLocationSwatch(name, colorMap).fill;
}

export function tripLocationBorderColor(
  name: string,
  colorMap?: Map<string, LocationPaletteSwatch>,
): string {
  return tripLocationSwatch(name, colorMap).accent;
}

export function tripLocationTextColor(
  name: string,
  colorMap?: Map<string, LocationPaletteSwatch>,
): string {
  return tripLocationSwatch(name, colorMap).text;
}
