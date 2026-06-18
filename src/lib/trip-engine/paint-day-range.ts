import { stayDatesForSelection } from "@/lib/host/setup/day-selection-setup";
import type { NightPairSelection } from "@/lib/host/setup/night-pair-selection";
import {
  clearStayCityFromDay,
  inferDayPlacesFromStay,
  normalizeInteriorStayDays,
} from "@/lib/host/setup-inference";
import {
  addDays,
  DEFAULT_HALF_SHARE,
  enumerateDates,
  locationsMatch,
  type HalfSide,
} from "@/lib/host/wizard/location-stays";
import type { DayPlaceDraft } from "@/lib/host/wizard/types";

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
    return { ...day, secondaryCity: null, primaryShare: primary ? 1 : share, dayType: "trip" };
  }
  if (primary && share < 0.99) {
    return { ...day, primaryCity: "", primaryShare: 1, dayType: "trip" };
  }
  return day;
}

function dayHasPaint(day: DayPlaceDraft): boolean {
  return Boolean(day.primaryCity.trim() || day.secondaryCity?.trim());
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

  return days.map((day) => {
    if (day.date < rangeStart || day.date > end) return day;

    if (rangeStart === end) {
      if (startHalf === "left") return paintHalf({ ...day, secondaryCity: null, primaryShare: 1 }, location, "left");
      if (startHalf === "right") return paintHalf({ ...day, primaryCity: "", primaryShare: 1 }, location, "right");
      if (startHalf === "full" && endHalf === "left") {
        return paintHalf({ ...day, secondaryCity: null, primaryShare: 1 }, location, "left");
      }
      if (startHalf === "full" && endHalf === "right") {
        return paintHalf({ ...day, primaryCity: "", primaryShare: 1 }, location, "right");
      }
      return day;
    }

    if (day.date === rangeStart && startHalf === "right") {
      return paintHalf({ ...day, primaryCity: day.primaryCity, secondaryCity: null, primaryShare: 1 }, location, "right");
    }
    if (day.date === end && endHalf === "left") {
      return paintHalf({ ...day, secondaryCity: null, primaryShare: 1 }, location, "left");
    }
    if (day.date === rangeStart && startHalf === "left") {
      return paintHalf({ ...day, secondaryCity: null, primaryShare: 1 }, location, "left");
    }
    if (day.date === end && endHalf === "right") {
      return paintHalf({ ...day, primaryCity: day.primaryCity, secondaryCity: null, primaryShare: 1 }, location, "right");
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

/** Paint location on a calendar range without clearing the rest of the trip. */
export function paintLocationDayRange(
  days: DayPlaceDraft[],
  rangeStart: string,
  rangeEnd: string,
  location: string,
  startHalf: HalfSide | "full" = "full",
  endHalf: HalfSide | "full" = "full",
): DayPlaceDraft[] {
  const loc = location.trim();
  const end = rangeEnd || rangeStart;

  if (rangeStart === end) {
    return paintLocationSingleDay(days, rangeStart, end, loc, startHalf, endHalf);
  }

  const { checkIn, checkOut } = stayDatesForSelection({
    rangeStart,
    rangeEnd: end,
    startHalf,
    endHalf,
  });

  const syntheticStay = {
    cityLabel: loc,
    checkInDate: checkIn,
    checkOutDate: checkOut,
    name: "__location_paint__",
  };

  let result = clearLocationSpillAfterCheckout(days, checkOut, loc);
  result = inferDayPlacesFromStay(result, syntheticStay);
  result = normalizeInteriorStayDays(result, [syntheticStay]);

  return result.filter((d) => d.primaryCity.trim() || d.secondaryCity?.trim());
}
