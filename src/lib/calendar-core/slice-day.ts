import { addDays, enumerateDates, locationsMatch } from "@/lib/host/wizard/location-stays";
import type { DayType } from "@/lib/host/wizard/types";

import type { CalendarDaySlice, CalendarHalf } from "./types";

export function emptySlice(date: string): CalendarDaySlice {
  return { date, amCity: "", pmCity: "", dayType: "trip" };
}

export function sliceHasPaint(slice: CalendarDaySlice): boolean {
  return Boolean(slice.amCity.trim() || slice.pmCity.trim());
}

export function isEmptySlice(slice: CalendarDaySlice): boolean {
  return !sliceHasPaint(slice);
}

export function fullDaySlice(date: string, city: string, dayType: DayType = "trip"): CalendarDaySlice {
  const loc = city.trim();
  return { date, amCity: loc, pmCity: loc, dayType };
}

export function travelDaySlice(
  date: string,
  amCity: string,
  pmCity: string,
  dayType: DayType = "travel",
): CalendarDaySlice {
  return {
    date,
    amCity: amCity.trim(),
    pmCity: pmCity.trim(),
    dayType,
  };
}

export function endingCityOnSlice(slice: CalendarDaySlice): string {
  return slice.pmCity.trim() || slice.amCity.trim();
}

export function startingCityOnSlice(slice: CalendarDaySlice): string {
  if (!slice.amCity.trim() && slice.pmCity.trim()) return slice.pmCity.trim();
  return slice.amCity.trim() || slice.pmCity.trim();
}

export function cityOnHalf(slice: CalendarDaySlice, half: CalendarHalf): string {
  return half === "am" ? slice.amCity.trim() : slice.pmCity.trim();
}

export function isTravelSplitSlice(slice: CalendarDaySlice): boolean {
  const am = slice.amCity.trim();
  const pm = slice.pmCity.trim();
  return Boolean(am && pm && !locationsMatch(am, pm));
}

export function isFullSingleCitySlice(slice: CalendarDaySlice): boolean {
  const am = slice.amCity.trim();
  const pm = slice.pmCity.trim();
  return Boolean(am && locationsMatch(am, pm));
}

export function inferDayType(slice: CalendarDaySlice): DayType {
  const am = slice.amCity.trim();
  const pm = slice.pmCity.trim();
  if (!am || !pm) return slice.dayType === "buffer" ? "buffer" : "trip";
  if (locationsMatch(am, pm)) return slice.dayType === "buffer" ? "buffer" : "trip";
  return "travel";
}

export function normalizeSlice(slice: CalendarDaySlice): CalendarDaySlice {
  const am = slice.amCity.trim();
  const pm = slice.pmCity.trim();
  if (!am && !pm) return emptySlice(slice.date);
  return {
    date: slice.date,
    amCity: am,
    pmCity: pm,
    dayType: inferDayType({ ...slice, amCity: am, pmCity: pm }),
  };
}

export function paintHalf(
  slice: CalendarDaySlice,
  half: CalendarHalf,
  city: string,
): CalendarDaySlice {
  const loc = city.trim();
  if (half === "am") {
    return normalizeSlice({ ...slice, amCity: loc });
  }
  return normalizeSlice({ ...slice, pmCity: loc });
}

export function clearHalf(slice: CalendarDaySlice, half: CalendarHalf): CalendarDaySlice {
  if (half === "am") {
    const next = { ...slice, amCity: "" };
    if (!next.pmCity.trim()) return emptySlice(slice.date);
    return normalizeSlice(next);
  }
  const next = { ...slice, pmCity: "" };
  if (!next.amCity.trim()) return emptySlice(slice.date);
  return normalizeSlice(next);
}

export function clearCityFromSlice(slice: CalendarDaySlice, city: string): CalendarDaySlice {
  const loc = city.trim();
  if (!loc) return slice;
  let next = slice;
  if (locationsMatch(next.amCity, loc)) next = clearHalf(next, "am");
  if (locationsMatch(next.pmCity, loc)) next = clearHalf(next, "pm");
  return next;
}

export function indexSlices(slices: CalendarDaySlice[]): Map<string, CalendarDaySlice> {
  return new Map(slices.map((s) => [s.date, s]));
}

export function sortedSliceValues(byDate: Map<string, CalendarDaySlice>): CalendarDaySlice[] {
  return [...byDate.values()]
    .filter(sliceHasPaint)
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function ensureSlicesInRange(
  slices: CalendarDaySlice[],
  rangeStart: string,
  rangeEnd: string,
): CalendarDaySlice[] {
  const byDate = indexSlices(slices);
  const end = rangeEnd || rangeStart;
  for (const iso of enumerateDates(rangeStart, end)) {
    if (!byDate.has(iso)) byDate.set(iso, emptySlice(iso));
  }
  return sortedSliceValues(byDate);
}

export function priorSliceCity(
  byDate: Map<string, CalendarDaySlice>,
  date: string,
): string {
  const prev = byDate.get(addDays(date, -1));
  return prev ? endingCityOnSlice(prev) : "";
}

export function nextSliceCity(
  byDate: Map<string, CalendarDaySlice>,
  date: string,
): string {
  const next = byDate.get(addDays(date, 1));
  return next ? startingCityOnSlice(next) : "";
}
