import { addDays, enumerateDates, locationsMatch } from "@/lib/host/wizard/location-stays";
import { stayDateBoundsForSelection } from "@/lib/host/setup/day-selection-setup";

import {
  emptySlice,
  ensureSlicesInRange,
  endingCityOnSlice,
  fullDaySlice,
  indexSlices,
  paintHalf,
  priorSliceCity,
  nextSliceCity,
  sortedSliceValues,
  startingCityOnSlice,
  travelDaySlice,
} from "./slice-day";
import { applyStayAlignedPaint } from "./set-days";
import type { CalendarDaySlice, HalfSelection, PaintRangeOptions } from "./types";

function toHalfSelection(half: HalfSelection): "am" | "pm" | "full" {
  return half;
}

function paintEdgeSlice(
  slice: CalendarDaySlice,
  city: string,
  half: HalfSelection,
): CalendarDaySlice {
  const loc = city.trim();
  if (half === "full") return fullDaySlice(slice.date, loc);
  return paintHalf(slice, half, loc);
}

function paintHalfAwareRange(
  slices: CalendarDaySlice[],
  rangeStart: string,
  rangeEnd: string,
  city: string,
  startHalf: HalfSelection,
  endHalf: HalfSelection,
): CalendarDaySlice[] {
  const end = rangeEnd || rangeStart;
  const byDate = indexSlices(ensureSlicesInRange(slices, rangeStart, end));

  for (const iso of enumerateDates(rangeStart, end)) {
    const current = byDate.get(iso) ?? emptySlice(iso);
    if (rangeStart === end) {
      if (startHalf === "full" && endHalf === "full") {
        byDate.set(iso, fullDaySlice(iso, city));
      } else if (startHalf !== "full") {
        byDate.set(iso, paintHalf(current, startHalf, city));
      } else if (endHalf !== "full") {
        byDate.set(iso, paintHalf(current, endHalf, city));
      }
      continue;
    }

    if (iso === rangeStart) {
      byDate.set(iso, paintEdgeSlice(current, city, startHalf));
    } else if (iso === end) {
      byDate.set(iso, paintEdgeSlice(current, city, endHalf));
    } else {
      byDate.set(iso, fullDaySlice(iso, city));
    }
  }

  return sortedSliceValues(byDate);
}

function paintStayAlignedRange(
  slices: CalendarDaySlice[],
  rangeStart: string,
  rangeEnd: string,
  city: string,
  startHalf: HalfSelection,
  endHalf: HalfSelection,
  options?: PaintRangeOptions,
): CalendarDaySlice[] {
  const end = rangeEnd || rangeStart;
  const bounds = stayDateBoundsForSelection({
    rangeStart,
    rangeEnd: end,
    startHalf: startHalf === "pm" ? "right" : startHalf === "am" ? "left" : "full",
    endHalf: endHalf === "pm" ? "right" : endHalf === "am" ? "left" : "full",
  });

  const contextSlices = ensureSlicesInRange(
    options?.transitionContextSlices ?? slices,
    rangeStart,
    end,
  );
  const contextByDate = indexSlices(contextSlices);

  let result = applyStayAlignedPaint(slices, city, bounds.checkIn, bounds.checkOut, {
    from: rangeStart,
    to: end,
  });
  const byDate = indexSlices(result);

  const departCity = (() => {
    const prev = contextByDate.get(addDays(rangeStart, -1));
    if (prev) {
      const c = endingCityOnSlice(prev);
      if (c && !locationsMatch(c, city)) return c;
    }
    const current = byDate.get(rangeStart);
    if (current) {
      const am = current.amCity.trim();
      if (am && !locationsMatch(am, city)) return am;
    }
    return "";
  })();

  const arrivalCity = (() => {
    const next = contextByDate.get(addDays(end, 1));
    if (next) {
      const c = startingCityOnSlice(next);
      if (c && !locationsMatch(c, city)) return c;
    }
    const current = byDate.get(end);
    if (current) {
      const pm = current.pmCity.trim();
      if (pm && !locationsMatch(pm, city)) return pm;
    }
    return "";
  })();

  if (departCity && rangeStart !== end) {
    byDate.set(
      rangeStart,
      travelDaySlice(rangeStart, departCity, city),
    );
  }

  if (arrivalCity && end !== rangeStart && endHalf !== "full") {
    byDate.set(end, travelDaySlice(end, city, arrivalCity));
  }

  return sortedSliceValues(byDate);
}

/** Paint location on a calendar range using explicit AM/PM slices. */
export function paintRange(
  slices: CalendarDaySlice[],
  rangeStart: string,
  rangeEnd: string,
  city: string,
  startHalf: HalfSelection = "full",
  endHalf: HalfSelection = "full",
  options?: PaintRangeOptions,
): CalendarDaySlice[] {
  const loc = city.trim();
  if (!loc) return slices;

  const end = rangeEnd || rangeStart;

  if (rangeStart === end) {
    const byDate = indexSlices(slices);
    const current = byDate.get(rangeStart) ?? emptySlice(rangeStart);
    if (startHalf === "full" && endHalf === "full") {
      byDate.set(rangeStart, fullDaySlice(rangeStart, loc));
    } else if (startHalf !== "full" && endHalf !== "full" && startHalf === endHalf) {
      byDate.set(rangeStart, paintHalf(current, startHalf, loc));
    } else if (startHalf !== "full") {
      byDate.set(rangeStart, paintHalf(current, startHalf, loc));
    } else if (endHalf !== "full") {
      byDate.set(rangeStart, paintHalf(current, endHalf, loc));
    }
    return sortedSliceValues(byDate);
  }

  const bothPartial = startHalf !== "full" && endHalf !== "full";
  if (bothPartial) {
    return paintHalfAwareRange(slices, rangeStart, end, loc, startHalf, endHalf);
  }

  return paintStayAlignedRange(slices, rangeStart, end, loc, startHalf, endHalf, options);
}

export { toHalfSelection };
