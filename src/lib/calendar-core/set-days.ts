import { addDays, enumerateDates } from "@/lib/host/wizard/location-stays";
import type { DayPlaceDraft } from "@/lib/host/wizard/types";

import { dayPlaceToSlice, sliceToDayPlace } from "./adapters";
import {
  clearCityFromSlice,
  emptySlice,
  indexSlices,
  paintHalf,
  sortedSliceValues,
} from "./slice-day";
import type { CalendarDaySlice } from "./types";

/** Apply stay-aligned city paint: check-in PM, check-out AM, interior full days. */
export function applyStayAlignedPaint(
  existing: CalendarDaySlice[],
  city: string,
  checkIn: string,
  checkOut: string,
  clip?: { from: string; to: string },
): CalendarDaySlice[] {
  const loc = city.trim();
  if (!loc || checkIn >= checkOut) return existing;

  const byDate = indexSlices(existing);
  const clipFrom = clip?.from ?? checkIn;
  const clipTo = clip?.to ?? addDays(checkOut, -1);

  for (const iso of enumerateDates(clipFrom, clipTo)) {
    const current = byDate.get(iso);
    if (!current) continue;
    const cleared = clearCityFromSlice(current, loc);
    if (!cleared.amCity.trim() && !cleared.pmCity.trim()) {
      byDate.delete(iso);
    } else {
      byDate.set(iso, cleared);
    }
  }

  let cursor = checkIn;
  while (cursor < checkOut) {
    const nightDate = cursor;
    const morningDate = addDays(cursor, 1);

    if (nightDate >= clipFrom && nightDate <= clipTo) {
      const evening = byDate.get(nightDate) ?? emptySlice(nightDate);
      byDate.set(nightDate, paintHalf(evening, "pm", loc));
    }
    if (morningDate >= clipFrom && morningDate <= clipTo) {
      const morning = byDate.get(morningDate) ?? emptySlice(morningDate);
      byDate.set(morningDate, paintHalf(morning, "am", loc));
    }
    cursor = addDays(cursor, 1);
  }

  return sortedSliceValues(byDate);
}

/** Write check-in PM and check-out AM slices for a named stay. */
export function alignStayToSlices(
  slices: CalendarDaySlice[],
  city: string,
  checkIn: string,
  checkOut: string,
): CalendarDaySlice[] {
  return applyStayAlignedPaint(slices, city, checkIn, checkOut, {
    from: checkIn,
    to: checkOut,
  });
}

/** Bulk set day places (AI/import) — converts legacy DayPlaceDraft rows to slices. */
export function setDaysFromLegacy(
  existing: CalendarDaySlice[],
  incoming: DayPlaceDraft[],
): CalendarDaySlice[] {
  const byDate = indexSlices(existing);
  for (const day of incoming) {
    const slice = dayPlaceToSlice(day);
    if (!slice.amCity.trim() && !slice.pmCity.trim()) {
      byDate.delete(day.date);
    } else {
      byDate.set(day.date, slice);
    }
  }
  return sortedSliceValues(byDate);
}

export function setDays(
  existing: CalendarDaySlice[],
  incoming: CalendarDaySlice[],
): CalendarDaySlice[] {
  const byDate = indexSlices(existing);
  for (const slice of incoming) {
    if (!slice.amCity.trim() && !slice.pmCity.trim()) {
      byDate.delete(slice.date);
    } else {
      byDate.set(slice.date, slice);
    }
  }
  return sortedSliceValues(byDate);
}

/** Export slices as legacy DayPlaceDraft for UI bridge. */
export function slicesToLegacyDays(slices: CalendarDaySlice[]): DayPlaceDraft[] {
  return slices.map(sliceToDayPlace);
}
