import type { DayType } from "@/lib/host/wizard/types";

import { emptySlice, normalizeSlice, sliceHasPaint } from "./slice-day";
import type { CalendarDaySlice, GroupCalendarMode, SliceOverride } from "./types";

/** Merge main group slices with override slices — the only projection merge. */
export function mergeOverrides(
  mainSlices: CalendarDaySlice[],
  overrideSlices: CalendarDaySlice[],
  mode: GroupCalendarMode,
): CalendarDaySlice[] {
  if (mode === "inherit") return mainSlices;

  const mainByDate = new Map(mainSlices.map((s) => [s.date, s]));
  const overrideByDate = new Map(overrideSlices.map((s) => [s.date, s]));
  const dates = new Set([...mainByDate.keys(), ...overrideByDate.keys()]);

  return [...dates]
    .sort()
    .map((date) => {
      const main = mainByDate.get(date) ?? emptySlice(date);
      const override = overrideByDate.get(date);
      if (!override) return main;
      return normalizeSlice(override);
    })
    .filter(sliceHasPaint);
}

/** Build sparse override storage: only dates that differ from main. */
export function extractOverrides(
  mainSlices: CalendarDaySlice[],
  personalSlices: CalendarDaySlice[],
): CalendarDaySlice[] {
  const mainByDate = new Map(mainSlices.map((s) => [s.date, s]));
  const overrides: CalendarDaySlice[] = [];

  for (const personal of personalSlices) {
    const main = mainByDate.get(personal.date) ?? emptySlice(personal.date);
    const amDiff = personal.amCity.trim() !== main.amCity.trim();
    const pmDiff = personal.pmCity.trim() !== main.pmCity.trim();
    if (!amDiff && !pmDiff) continue;

    overrides.push({
      date: personal.date,
      amCity: amDiff ? personal.amCity : "",
      pmCity: pmDiff ? personal.pmCity : "",
      dayType: personal.dayType,
    });
  }

  return overrides;
}

/** Apply sparse override list to produce projected calendar for a group. */
export function projectGroupSlices(
  mainSlices: CalendarDaySlice[],
  storedOverrides: SliceOverride[],
  mode: GroupCalendarMode,
): CalendarDaySlice[] {
  if (mode === "inherit") return mainSlices;

  const overrideSlices: CalendarDaySlice[] = storedOverrides.map((o) => ({
    date: o.date,
    amCity: o.amCity ?? "",
    pmCity: o.pmCity ?? "",
    dayType: (o.dayType ?? "trip") as DayType,
  }));

  return mergeOverrides(mainSlices, overrideSlices, "override");
}
