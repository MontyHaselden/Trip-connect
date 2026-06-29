import { enumerateDates } from "@/lib/host/wizard/location-stays";
import { stayDatesForSelection } from "@/lib/host/setup/day-selection-setup";
import type { NightPairSelection } from "@/lib/host/setup/night-pair-selection";

import { normalizeHalfSelection } from "./half-map";
import {
  clearHalf,
  emptySlice,
  indexSlices,
  sliceHasPaint,
  sortedSliceValues,
} from "./slice-day";
import type { CalendarDaySlice, CalendarHalf, HalfSelection } from "./types";

function halfFromSelection(half: HalfSelection): CalendarHalf | null {
  if (half === "am" || half === "pm") return half;
  return null;
}

function normalizedSelection(selection: NightPairSelection): {
  rangeStart: string;
  rangeEnd: string;
  startHalf: HalfSelection;
  endHalf: HalfSelection;
} {
  return {
    rangeStart: selection.rangeStart,
    rangeEnd: selection.rangeEnd || selection.rangeStart,
    startHalf: normalizeHalfSelection(selection.startHalf ?? "full"),
    endHalf: normalizeHalfSelection(selection.endHalf ?? "full"),
  };
}

/** Remove location paint across a selection span. */
export function clearRange(
  slices: CalendarDaySlice[],
  selection: NightPairSelection,
): CalendarDaySlice[] {
  const normalized = normalizedSelection(selection);
  const end = normalized.rangeEnd;
  const startHalf = normalized.startHalf;
  const endHalf = normalized.endHalf;
  const byDate = indexSlices(slices);

  if (normalized.rangeStart === end && startHalf === "full" && endHalf === "full") {
    byDate.delete(normalized.rangeStart);
    return sortedSliceValues(byDate);
  }

  if (normalized.rangeStart === end && startHalf !== "full") {
    const half = halfFromSelection(startHalf);
    if (!half) return slices;
    const day = byDate.get(normalized.rangeStart);
    if (!day) return slices;
    const cleared = clearHalf(day, half);
    if (sliceHasPaint(cleared)) byDate.set(normalized.rangeStart, cleared);
    else byDate.delete(normalized.rangeStart);
    return sortedSliceValues(byDate);
  }

  const { checkIn, checkOut } = stayDatesForSelection({
    rangeStart: normalized.rangeStart,
    rangeEnd: end,
    startHalf: selection.startHalf ?? "full",
    endHalf: selection.endHalf ?? "full",
  });
  const multiDay = checkIn !== checkOut;

  for (const date of enumerateDates(checkIn, checkOut)) {
    const day = byDate.get(date);
    if (!day) continue;

    const isCheckIn = date === checkIn;
    const isCheckOut = date === checkOut;

    if (multiDay && isCheckIn && startHalf === "pm") {
      const cleared = clearHalf(day, "pm");
      if (sliceHasPaint(cleared)) byDate.set(date, cleared);
      else byDate.delete(date);
      continue;
    }

    if (multiDay && isCheckIn && startHalf === "am") {
      const cleared = clearHalf(day, "am");
      if (sliceHasPaint(cleared)) byDate.set(date, cleared);
      else byDate.delete(date);
      continue;
    }

    if (multiDay && isCheckOut && endHalf === "pm") {
      const cleared = clearHalf(day, "pm");
      if (sliceHasPaint(cleared)) byDate.set(date, cleared);
      else byDate.delete(date);
      continue;
    }

    if (multiDay && isCheckOut && (endHalf === "full" || endHalf === "am")) {
      const cleared = clearHalf(day, "am");
      if (sliceHasPaint(cleared)) byDate.set(date, cleared);
      else byDate.delete(date);
      continue;
    }

    if (multiDay && isCheckIn && startHalf === "full") {
      const cleared = clearHalf(day, "pm");
      if (sliceHasPaint(cleared)) byDate.set(date, cleared);
      else byDate.delete(date);
      continue;
    }

    if (!isCheckIn && !isCheckOut) {
      byDate.delete(date);
    }
  }

  return sortedSliceValues(byDate);
}
