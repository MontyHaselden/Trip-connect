import { stayDatesForSelection } from "@/lib/host/setup/day-selection-setup";
import type { NightPairSelection } from "@/lib/host/setup/night-pair-selection";
import {
  clearStayCityFromDay,
} from "@/lib/host/setup-inference";
import {
  addDays,
  DEFAULT_HALF_SHARE,
  enumerateDates,
  locationsMatch,
  type HalfSide,
} from "@/lib/host/wizard/location-stays";
import type { DayPlaceDraft } from "@/lib/host/wizard/types";

import { protectTravelSplitDays, isTravelSplitDay } from "./paint-location-preflight";

export type PaintLocationDayRangeOptions = {
  /** Adjacent-day context for arrival/departure half-days (e.g. main group when painting personal overlay). */
  transitionContextDays?: DayPlaceDraft[];
  /** Only restore travel splits that existed here; defaults to the full `days` input. */
  protectOriginals?: DayPlaceDraft[];
};

function emptyDay(date: string): DayPlaceDraft {
  return {
    date,
    primaryCity: "",
    secondaryCity: null,
    primaryShare: 1,
    dayType: "trip",
    includeBuffer: false,
  };
}

function paintHalf(day: DayPlaceDraft, location: string, half: HalfSide): DayPlaceDraft {
  const loc = location.trim();
  if (half === "right") {
    return {
      ...day,
      secondaryCity: loc,
      primaryShare: DEFAULT_HALF_SHARE,
      dayType: day.dayType === "buffer" ? "buffer" : "travel",
    };
  }
  return {
    ...day,
    primaryCity: loc,
    primaryShare: DEFAULT_HALF_SHARE,
    dayType: day.dayType === "buffer" ? "buffer" : "travel",
  };
}

/** Remove full-day spill of a location after checkout from a prior wider paint. */
function clearLocationSpillAfterCheckout(
  days: DayPlaceDraft[],
  checkOutDate: string,
  location: string,
): DayPlaceDraft[] {
  const loc = location.trim();
  const byDate = new Map(days.map((d) => [d.date, d]));
  let cursor = addDays(checkOutDate, 1);

  while (true) {
    const day = byDate.get(cursor);
    if (!day) break;

    const primary = day.primaryCity.trim();
    const secondary = day.secondaryCity?.trim() ?? "";
    const share = day.primaryShare ?? 1;
    const isFullSpill =
      primary &&
      locationsMatch(primary, loc) &&
      !secondary &&
      share >= 0.99;
    const isHalfSpill =
      !primary && secondary && locationsMatch(secondary, loc);

    if (!isFullSpill && !isHalfSpill) break;

    const cleared = clearStayCityFromDay(day, loc);
    if (!cleared.primaryCity.trim() && !cleared.secondaryCity?.trim()) {
      byDate.delete(cursor);
    } else {
      byDate.set(cursor, cleared);
    }
    cursor = addDays(cursor, 1);
  }

  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

function clearHalfLocation(day: DayPlaceDraft, half: HalfSide): DayPlaceDraft {
  const primary = day.primaryCity.trim();
  const secondary = day.secondaryCity?.trim() ?? "";
  const share = day.primaryShare ?? 1;

  if (half === "left") {
    if (primary && share < 0.99) {
      return { ...day, primaryCity: "", primaryShare: secondary ? share : 1, dayType: "trip" };
    }
    if (primary && !secondary) {
      return emptyDay(day.date);
    }
    return day;
  }

  if (secondary) {
    const keepHalf =
      primary && (share < 0.99 || day.dayType === "travel");
    return {
      ...day,
      secondaryCity: null,
      primaryShare: keepHalf ? DEFAULT_HALF_SHARE : primary ? 1 : share,
      dayType: keepHalf ? "trip" : "trip",
    };
  }
  if (primary && share < 0.99) {
    return { ...day, primaryCity: "", primaryShare: 1, dayType: "trip" };
  }
  return day;
}

function dayHasPaint(day: DayPlaceDraft): boolean {
  return Boolean(day.primaryCity.trim() || day.secondaryCity?.trim());
}

function endingCityOnDay(day: DayPlaceDraft): string {
  const secondary = day.secondaryCity?.trim() ?? "";
  const primary = day.primaryCity.trim();
  return secondary || primary;
}

function departureEdgeDay(date: string, city: string): DayPlaceDraft {
  return {
    date,
    primaryCity: city,
    secondaryCity: null,
    primaryShare: DEFAULT_HALF_SHARE,
    dayType: "trip",
    includeBuffer: false,
  };
}

function startingCityOnDay(day: DayPlaceDraft): string {
  const primary = day.primaryCity.trim();
  const secondary = day.secondaryCity?.trim() ?? "";
  if (!primary && secondary) return secondary;
  return primary || secondary;
}

function isFullSingleCityDay(day: DayPlaceDraft): boolean {
  const primary = day.primaryCity.trim();
  const secondary = day.secondaryCity?.trim() ?? "";
  const share = day.primaryShare ?? 1;
  return Boolean(primary && !secondary && share >= 0.99);
}

function isTravelSplitDayPaint(day: DayPlaceDraft): boolean {
  const primary = day.primaryCity.trim();
  const secondary = day.secondaryCity?.trim() ?? "";
  const share = day.primaryShare ?? 1;
  return Boolean(primary && secondary && share < 0.99);
}

function paintDepartureTransitionDay(
  day: DayPlaceDraft,
  location: string,
  nextCity: string,
): DayPlaceDraft {
  return {
    date: day.date,
    primaryCity: location.trim(),
    secondaryCity: nextCity.trim(),
    primaryShare: DEFAULT_HALF_SHARE,
    dayType: day.dayType === "buffer" ? "buffer" : "travel",
    includeBuffer: day.includeBuffer,
  };
}

/** Fix stale full-day rows that should be intercity travel splits between neighbours. */
export function repairIntercityTransitionDays(days: DayPlaceDraft[]): DayPlaceDraft[] {
  const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date));
  const byDate = new Map(sorted.map((day) => [day.date, { ...day }]));

  for (let i = 0; i < sorted.length; i++) {
    const date = sorted[i]!.date;
    const day = byDate.get(date)!;
    if (isTravelSplitDayPaint(day) || !isFullSingleCityDay(day)) continue;

    const loc = day.primaryCity.trim();
    const prev = i > 0 ? byDate.get(sorted[i - 1]!.date) : undefined;
    const prevCity = prev ? endingCityOnDay(prev) : "";
    if (prevCity && !locationsMatch(prevCity, loc)) {
      byDate.set(date, paintArrivalTransitionDay(day, loc, prevCity));
      continue;
    }

    const next = i < sorted.length - 1 ? byDate.get(sorted[i + 1]!.date) : undefined;
    const nextCity = next ? startingCityOnDay(next) : "";
    if (nextCity && !locationsMatch(nextCity, loc)) {
      byDate.set(date, paintDepartureTransitionDay(day, loc, nextCity));
    }
  }

  return [...byDate.values()]
    .filter((day) => day.primaryCity.trim() || day.secondaryCity?.trim())
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Remove location paint across a selection using the same night span as apply/paint. */
export function clearAllLocationInSpan(
  days: DayPlaceDraft[],
  selection: NightPairSelection,
): DayPlaceDraft[] {
  const end = selection.rangeEnd || selection.rangeStart;
  const startHalf = selection.startHalf ?? "full";
  const endHalf = selection.endHalf ?? "full";
  const byDate = new Map(days.map((d) => [d.date, d]));

  if (selection.rangeStart === end && startHalf === "full" && endHalf === "full") {
    byDate.delete(selection.rangeStart);
    return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  }

  if (selection.rangeStart === end && startHalf !== "full") {
    const day = byDate.get(selection.rangeStart);
    if (!day) return days;
    const cleared = clearHalfLocation(day, startHalf);
    if (dayHasPaint(cleared)) byDate.set(selection.rangeStart, cleared);
    else byDate.delete(selection.rangeStart);
    return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  }

  const { checkIn, checkOut } = stayDatesForSelection({
    rangeStart: selection.rangeStart,
    rangeEnd: end,
    startHalf,
    endHalf,
  });
  const multiDay = checkIn !== checkOut;

  for (const date of enumerateDates(checkIn, checkOut)) {
    const day = byDate.get(date);
    if (!day) continue;

    const isCheckIn = date === checkIn;
    const isCheckOut = date === checkOut;

    if (multiDay && isCheckIn && startHalf === "right") {
      const cleared = clearHalfLocation(day, "right");
      if (dayHasPaint(cleared)) byDate.set(date, cleared);
      else byDate.delete(date);
      continue;
    }

    if (multiDay && isCheckIn && startHalf === "left") {
      const cleared = clearHalfLocation(day, "left");
      if (dayHasPaint(cleared)) byDate.set(date, cleared);
      else byDate.delete(date);
      continue;
    }

    if (multiDay && isCheckOut && endHalf === "right") {
      const cleared = clearHalfLocation(day, "right");
      if (dayHasPaint(cleared)) byDate.set(date, cleared);
      else byDate.delete(date);
      continue;
    }

    if (multiDay && isCheckOut && (endHalf === "full" || endHalf === "left")) {
      const cleared = clearHalfLocation(day, "left");
      if (dayHasPaint(cleared)) byDate.set(date, cleared);
      else byDate.delete(date);
      continue;
    }

    if (multiDay && isCheckIn && startHalf === "full") {
      const primary = day.primaryCity.trim();
      const secondary = day.secondaryCity?.trim() ?? "";
      const share = day.primaryShare ?? 1;
      const isFullIncomingOnly = primary && !secondary && share >= 0.99;

      if (isFullIncomingOnly) {
        const prev = byDate.get(addDays(date, -1));
        const prevCity = prev ? endingCityOnDay(prev) : "";
        if (prevCity) {
          byDate.set(date, departureEdgeDay(date, prevCity));
        } else {
          byDate.delete(date);
        }
        continue;
      }

      const cleared = clearHalfLocation(day, "right");
      if (dayHasPaint(cleared)) byDate.set(date, cleared);
      else byDate.delete(date);
      continue;
    }

    if (!isCheckIn && !isCheckOut) {
      byDate.delete(date);
    }
  }

  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/** Remove consecutive full-day location-only rows after checkout from a prior wider paint. */
export function clearFullLocationDaysAfter(
  days: DayPlaceDraft[],
  afterDate: string,
): DayPlaceDraft[] {
  const byDate = new Map(days.map((d) => [d.date, d]));
  let cursor = addDays(afterDate, 1);

  while (true) {
    const day = byDate.get(cursor);
    if (!day) break;

    const primary = day.primaryCity.trim();
    const secondary = day.secondaryCity?.trim() ?? "";
    const share = day.primaryShare ?? 1;
    const isSimpleFullDay = primary && !secondary && share >= 0.99;
    const isSimpleHalfOnly =
      !primary && secondary && share <= 0.51;

    if (!isSimpleFullDay && !isSimpleHalfOnly) break;

    byDate.delete(cursor);
    cursor = addDays(cursor, 1);
  }

  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/** Remove checkout-morning location paint left on the checkout date after a range clear. */
export function clearCheckoutLocationDay(
  days: DayPlaceDraft[],
  checkOut: string,
): DayPlaceDraft[] {
  return days
    .flatMap((day) => {
      if (day.date !== checkOut) return [day];

      const primary = day.primaryCity.trim();
      const secondary = day.secondaryCity?.trim() ?? "";
      const share = day.primaryShare ?? 1;

      if (!primary && secondary && share <= 0.51) return [];
      if (primary && share < 0.99 && !secondary) {
        return [{ ...day, primaryCity: "", secondaryCity: null, primaryShare: 1, dayType: "trip" as const }];
      }
      if (!primary && !secondary) return [];
      return [day];
    })
    .filter((d) => d.primaryCity.trim() || d.secondaryCity?.trim());
}

/** Ensure stub day rows exist for every date in a paint range. */
export function ensureDaysInPaintRange(
  days: DayPlaceDraft[],
  rangeStart: string,
  rangeEnd: string,
): DayPlaceDraft[] {
  const byDate = new Map(days.map((d) => [d.date, d]));
  const end = rangeEnd || rangeStart;
  for (const iso of enumerateDates(rangeStart, end)) {
    if (!byDate.has(iso)) byDate.set(iso, emptyDay(iso));
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/** Apply half-day constraints after a full-range location paint. */
export function applyHalfDayPaint(
  days: DayPlaceDraft[],
  rangeStart: string,
  rangeEnd: string,
  location: string,
  startHalf: HalfSide | "full",
  endHalf: HalfSide | "full",
): DayPlaceDraft[] {
  if (startHalf === "full" && endHalf === "full") return days;
  const end = rangeEnd || rangeStart;

  function prepForLeftHalf(day: DayPlaceDraft): DayPlaceDraft {
    const secondary = day.secondaryCity?.trim();
    if (secondary) {
      return { ...day, primaryShare: day.primaryShare ?? DEFAULT_HALF_SHARE };
    }
    return { ...day, secondaryCity: null, primaryShare: 1 };
  }

  function prepForRightHalf(day: DayPlaceDraft): DayPlaceDraft {
    const primary = day.primaryCity.trim();
    if (primary) {
      return { ...day, primaryShare: day.primaryShare ?? DEFAULT_HALF_SHARE };
    }
    return { ...day, primaryCity: "", primaryShare: 1 };
  }

  return days.map((day) => {
    if (day.date < rangeStart || day.date > end) return day;

    if (rangeStart === end) {
      if (startHalf === "left") return paintHalf(prepForLeftHalf(day), location, "left");
      if (startHalf === "right") return paintHalf(prepForRightHalf(day), location, "right");
      if (startHalf === "full" && endHalf === "left") {
        return paintHalf(prepForLeftHalf(day), location, "left");
      }
      if (startHalf === "full" && endHalf === "right") {
        return paintHalf(prepForRightHalf(day), location, "right");
      }
      return day;
    }

    if (day.date === rangeStart && startHalf === "right") {
      return paintHalf(prepForRightHalf(day), location, "right");
    }
    if (day.date === end && endHalf === "left") {
      return paintHalf(prepForLeftHalf(day), location, "left");
    }
    if (day.date === rangeStart && startHalf === "left") {
      return paintHalf(prepForLeftHalf(day), location, "left");
    }
    if (day.date === end && endHalf === "right") {
      return paintHalf(prepForRightHalf(day), location, "right");
    }
    return day;
  });
}

function paintLocationSingleDay(
  days: DayPlaceDraft[],
  rangeStart: string,
  rangeEnd: string,
  location: string,
  startHalf: HalfSide | "full",
  endHalf: HalfSide | "full",
): DayPlaceDraft[] {
  const loc = location.trim();
  const end = rangeEnd || rangeStart;
  let result = ensureDaysInPaintRange(days, rangeStart, end);

  result = result.map((day) => {
    if (day.date < rangeStart || day.date > end) return day;
    if (rangeStart !== end) {
      if (day.date === rangeStart && startHalf === "right") return day;
      if (day.date === end && endHalf === "left") return day;
    }
    if (rangeStart === end && startHalf !== "full") return day;

    return {
      ...day,
      primaryCity: loc,
      secondaryCity: null,
      primaryShare: 1,
      dayType: day.dayType === "buffer" ? "buffer" : "trip",
    };
  });

  return applyHalfDayPaint(result, rangeStart, end, loc, startHalf, endHalf);
}

function paintDayForRangeEdge(
  day: DayPlaceDraft,
  location: string,
  half: HalfSide | "full",
  context?: {
    edge: "start" | "end";
    startHalf: HalfSide | "full";
    endHalf: HalfSide | "full";
  },
): DayPlaceDraft {
  const loc = location.trim();
  if (half === "full") {
    return {
      ...day,
      primaryCity: loc,
      secondaryCity: null,
      primaryShare: 1,
      dayType: day.dayType === "buffer" ? "buffer" : "trip",
    };
  }

  let prepped = day;
  const primary = day.primaryCity.trim();
  const secondary = day.secondaryCity?.trim() ?? "";

  const preserveTravelArrival =
    context?.edge === "end" &&
    context.endHalf === "left" &&
    context.startHalf === "right" &&
    isTravelSplitDay(day) &&
    Boolean(secondary && !locationsMatch(secondary, loc));

  if (half === "left" && secondary && !locationsMatch(secondary, loc) && !preserveTravelArrival) {
    prepped = {
      ...day,
      secondaryCity: null,
      primaryShare: primary ? (day.primaryShare ?? DEFAULT_HALF_SHARE) : 1,
    };
  }

  if (half === "right" && primary && !locationsMatch(primary, loc)) {
    prepped = {
      ...day,
      primaryShare: day.primaryShare ?? DEFAULT_HALF_SHARE,
    };
  }

  const painted = paintHalf(prepped, loc, half);

  if (preserveTravelArrival && half === "left") {
    return {
      ...painted,
      primaryCity: primary || painted.primaryCity,
      secondaryCity: secondary,
      primaryShare: day.primaryShare ?? DEFAULT_HALF_SHARE,
      dayType: day.dayType === "buffer" ? "buffer" : "travel",
    };
  }

  return painted;
}

/** Paint only the selected calendar slices on range edges; full days between. */
function paintLocationHalfAwareCalendarRange(
  days: DayPlaceDraft[],
  rangeStart: string,
  rangeEnd: string,
  location: string,
  startHalf: HalfSide | "full",
  endHalf: HalfSide | "full",
): DayPlaceDraft[] {
  const loc = location.trim();
  const end = rangeEnd || rangeStart;
  let result = ensureDaysInPaintRange(days, rangeStart, end);
  const edgeContext = { startHalf, endHalf };

  result = result.map((day) => {
    if (day.date < rangeStart || day.date > end) return day;

    if (day.date === rangeStart) {
      return paintDayForRangeEdge(day, loc, startHalf, { edge: "start", ...edgeContext });
    }
    if (day.date === end) {
      return paintDayForRangeEdge(day, loc, endHalf, { edge: "end", ...edgeContext });
    }
    return {
      ...day,
      primaryCity: loc,
      secondaryCity: null,
      primaryShare: 1,
      dayType: day.dayType === "buffer" ? "buffer" : "trip",
    };
  });

  return result.filter((d) => d.primaryCity.trim() || d.secondaryCity?.trim());
}

function priorDepartCityForRangeStart(
  days: DayPlaceDraft[],
  rangeStart: string,
  location: string,
  contextDays?: DayPlaceDraft[],
): string | null {
  const contextByDate = new Map((contextDays ?? days).map((d) => [d.date, d]));
  const byDate = new Map(days.map((d) => [d.date, d]));
  const prev = contextByDate.get(addDays(rangeStart, -1));
  if (prev) {
    const city = endingCityOnDay(prev);
    if (city && !locationsMatch(city, location)) return city;
  }
  const current = byDate.get(rangeStart);
  if (current) {
    const primary = current.primaryCity.trim();
    if (primary && !locationsMatch(primary, location)) return primary;
  }
  return null;
}

function nextArrivalCityForRangeEnd(
  days: DayPlaceDraft[],
  rangeEnd: string,
  location: string,
  contextDays?: DayPlaceDraft[],
): string | null {
  const contextByDate = new Map((contextDays ?? days).map((d) => [d.date, d]));
  const byDate = new Map(days.map((d) => [d.date, d]));
  const next = contextByDate.get(addDays(rangeEnd, 1));
  if (next) {
    const city = startingCityOnDay(next);
    if (city && !locationsMatch(city, location)) return city;
  }
  const current = byDate.get(rangeEnd);
  if (current) {
    const secondary = current.secondaryCity?.trim() ?? "";
    if (secondary && !locationsMatch(secondary, location)) return secondary;
  }
  return null;
}

function paintArrivalTransitionDay(
  day: DayPlaceDraft,
  location: string,
  departCity: string,
): DayPlaceDraft {
  return {
    date: day.date,
    primaryCity: departCity,
    secondaryCity: location.trim(),
    primaryShare: DEFAULT_HALF_SHARE,
    dayType: day.dayType === "buffer" ? "buffer" : "travel",
    includeBuffer: day.includeBuffer,
  };
}

/** Paint every selected calendar day as full single-city, with a travel split on range start when needed. */
function paintLocationFullCalendarDays(
  days: DayPlaceDraft[],
  rangeStart: string,
  rangeEnd: string,
  location: string,
  transitionContextDays?: DayPlaceDraft[],
): DayPlaceDraft[] {
  const loc = location.trim();
  const end = rangeEnd || rangeStart;
  let result = ensureDaysInPaintRange(days, rangeStart, end);

  if (rangeStart === end) {
    result = result.map((day) => {
      if (day.date !== rangeStart) return day;
      return {
        ...day,
        primaryCity: loc,
        secondaryCity: null,
        primaryShare: 1,
        dayType: day.dayType === "buffer" ? "buffer" : "trip",
      };
    });
    return result.filter((d) => d.primaryCity.trim() || d.secondaryCity?.trim());
  }

  const departCity = priorDepartCityForRangeStart(result, rangeStart, loc, transitionContextDays);
  const arrivalCity = nextArrivalCityForRangeEnd(result, end, loc, transitionContextDays);

  result = result.map((day) => {
    if (day.date < rangeStart || day.date > end) return day;

    if (day.date === rangeStart && departCity) {
      return paintArrivalTransitionDay(day, loc, departCity);
    }

    if (day.date === end && end !== rangeStart && arrivalCity) {
      return paintDepartureTransitionDay(day, loc, arrivalCity);
    }

    return {
      ...day,
      primaryCity: loc,
      secondaryCity: null,
      primaryShare: 1,
      dayType: day.dayType === "buffer" ? "buffer" : "trip",
    };
  });
  return result.filter((d) => d.primaryCity.trim() || d.secondaryCity?.trim());
}

/** Paint location on a calendar range without clearing the rest of the trip. */
export function paintLocationDayRange(
  days: DayPlaceDraft[],
  rangeStart: string,
  rangeEnd: string,
  location: string,
  startHalf: HalfSide | "full" = "full",
  endHalf: HalfSide | "full" = "full",
  options?: PaintLocationDayRangeOptions,
): DayPlaceDraft[] {
  const loc = location.trim();
  const end = rangeEnd || rangeStart;
  const transitionContextDays = options?.transitionContextDays;

  if (rangeStart === end) {
    return paintLocationSingleDay(days, rangeStart, end, loc, startHalf, endHalf);
  }

  if (startHalf === "full" && endHalf === "full") {
    return clearLocationSpillAfterCheckout(
      paintLocationFullCalendarDays(days, rangeStart, end, loc, transitionContextDays),
      end,
      loc,
    );
  }

  const spillAfterCheckout = endHalf === "right" ? addDays(end, 1) : end;
  return clearLocationSpillAfterCheckout(
    paintLocationHalfAwareCalendarRange(
      days,
      rangeStart,
      end,
      loc,
      startHalf,
      endHalf,
    ),
    spillAfterCheckout,
    loc,
  );
}

/** Paint location on a calendar range, preserving travel split days at range edges. */
export function paintLocationDayRangeProtected(
  days: DayPlaceDraft[],
  rangeStart: string,
  rangeEnd: string,
  location: string,
  startHalf: HalfSide | "full" = "full",
  endHalf: HalfSide | "full" = "full",
  options?: PaintLocationDayRangeOptions,
): DayPlaceDraft[] {
  const protectFrom = options?.protectOriginals ?? days;
  const originals = new Map(protectFrom.map((day) => [day.date, day]));
  const painted = paintLocationDayRange(
    days,
    rangeStart,
    rangeEnd,
    location,
    startHalf,
    endHalf,
    options,
  );
  return protectTravelSplitDays(originals, painted, rangeStart, rangeEnd, startHalf, endHalf);
}
