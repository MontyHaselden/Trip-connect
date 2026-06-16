import { DateTime } from "luxon";

import { TRIP_DATES_UNSET, tripDatesAreUnset } from "@/lib/host/trip-date-display";
import type { AccommodationStayDraft, DayPlaceDraft } from "@/lib/host/wizard/types";

export const SETUP_CALENDAR_WEEKS = 6;

export function weekStartMonday(dt: DateTime): DateTime {
  return dt.minus({ days: (dt.weekday + 6) % 7 }).startOf("day");
}

function addDays(iso: string, delta: number): string {
  const d = DateTime.fromISO(iso);
  return d.plus({ days: delta }).toISODate()!;
}

export function todayIso(timezone: string): string {
  return DateTime.now().setZone(timezone).toISODate() ?? DateTime.utc().toISODate()!;
}

/** Mid-trip date used to center the calendar on first paint / refresh. */
export function tripCalendarScrollAnchor(tripStart: string, tripEnd: string): string {
  const start = DateTime.fromISO(tripStart);
  const end = DateTime.fromISO(tripEnd);
  if (!start.isValid || !end.isValid) return tripStart;
  const spanDays = Math.max(0, Math.floor(end.diff(start, "days").days));
  return start.plus({ days: Math.floor(spanDays / 2) }).toISODate() ?? tripStart;
}

function isMeaningfulCalendarDate(iso: string | null | undefined): iso is string {
  const trimmed = iso?.trim() ?? "";
  return Boolean(trimmed) && trimmed !== TRIP_DATES_UNSET;
}

export type CalendarScrollAnchorInput = {
  startDate: string;
  endDate: string;
  timezone: string;
  dayPlaces?: DayPlaceDraft[];
  accommodationStays?: AccommodationStayDraft[];
  transportDates?: string[];
  /** Used when trip dates are unset and no painted content exists yet. */
  fallbackAnchor?: string;
};

/** Center on real trip dates, painted days, or today — not the wide default scroll range. */
export function resolveCalendarScrollAnchor(input: CalendarScrollAnchorInput): string {
  if (!tripDatesAreUnset(input.startDate, input.endDate)) {
    return tripCalendarScrollAnchor(input.startDate, input.endDate);
  }

  const dates: string[] = [];

  for (const day of input.dayPlaces ?? []) {
    if (day.primaryCity.trim() || day.secondaryCity?.trim()) {
      if (isMeaningfulCalendarDate(day.date)) dates.push(day.date);
    }
  }

  for (const stay of input.accommodationStays ?? []) {
    if (isMeaningfulCalendarDate(stay.checkInDate)) dates.push(stay.checkInDate);
    if (isMeaningfulCalendarDate(stay.checkOutDate)) {
      dates.push(addDays(stay.checkOutDate, -1));
    }
  }

  for (const iso of input.transportDates ?? []) {
    if (isMeaningfulCalendarDate(iso)) dates.push(iso);
  }

  if (dates.length) {
    const sorted = [...dates].sort();
    return tripCalendarScrollAnchor(sorted[0]!, sorted[sorted.length - 1]!);
  }

  return input.fallbackAnchor?.trim() || todayIso(input.timezone);
}

/** Wider range for scrolling the calendar grid (all months visible while scrolling). */
export function calendarScrollBounds(
  startDate: string,
  endDate: string,
  timezone: string,
  anchorDate?: string | null,
): { scrollStart: string; scrollEnd: string } {
  const anchor = anchorDate?.trim() || todayIso(timezone);
  const anchorMonday = weekStartMonday(DateTime.fromISO(anchor));

  if (tripDatesAreUnset(startDate, endDate)) {
    const rangeMonday = weekStartMonday(anchorMonday.minus({ months: 3 }));
    const rangeEndMonday = weekStartMonday(anchorMonday.plus({ months: 15 }));
    return {
      scrollStart: rangeMonday.toISODate()!,
      scrollEnd: rangeEndMonday.plus({ days: 6 }).toISODate()!,
    };
  }

  const tripStartMonday = weekStartMonday(DateTime.fromISO(startDate));
  const tripEndMonday = weekStartMonday(DateTime.fromISO(endDate));

  return {
    scrollStart: weekStartMonday(tripStartMonday.minus({ months: 2 })).toISODate()!,
    scrollEnd: weekStartMonday(tripEndMonday.plus({ months: 3 })).plus({ days: 6 }).toISODate()!,
  };
}

/** Grid range for setup scroll calendar (Monday–Sunday aligned, no extra padding). */
export function calendarGridBounds(
  scrollStart: string,
  scrollEnd: string,
): { gridStart: string; gridEnd: string } {
  return { gridStart: scrollStart, gridEnd: scrollEnd };
}

export type CalendarGridFromTodayInput = {
  startDate: string;
  endDate: string;
  timezone: string;
  anchorDate?: string;
  dayPlaces?: DayPlaceDraft[];
  accommodationStays?: AccommodationStayDraft[];
  transportDates?: string[];
};

/** Scroll grid from today's week through trip padding — never renders days before todayIso. */
export function calendarGridFromToday(input: CalendarGridFromTodayInput): {
  gridStart: string;
  gridEnd: string;
  todayIso: string;
  interactionStart: string;
  scrollAnchorDate: string;
} {
  const today = todayIso(input.timezone);
  const scrollAnchorDate = resolveCalendarScrollAnchor({
    startDate: input.startDate,
    endDate: input.endDate,
    timezone: input.timezone,
    dayPlaces: input.dayPlaces,
    accommodationStays: input.accommodationStays,
    transportDates: input.transportDates,
    fallbackAnchor: today,
  });
  const anchor =
    input.anchorDate?.trim() ||
    (tripDatesAreUnset(input.startDate, input.endDate)
      ? today
      : scrollAnchorDate);
  const scroll = calendarScrollBounds(
    input.startDate,
    input.endDate,
    input.timezone,
    anchor,
  );
  const rawGrid = calendarGridBounds(scroll.scrollStart, scroll.scrollEnd);

  const todayMonday = weekStartMonday(DateTime.fromISO(today));
  const scrollMonday = weekStartMonday(DateTime.fromISO(rawGrid.gridStart));
  const datesSet = !tripDatesAreUnset(input.startDate, input.endDate);
  // Future trips: grid from today's week so hosts can scroll forward from now to trip dates.
  // Past / in-progress trips: never render weeks before today.
  const gridStart = datesSet
    ? todayMonday.toISODate()!
    : todayMonday > scrollMonday
      ? todayMonday.toISODate()!
      : rawGrid.gridStart;

  return {
    gridStart,
    gridEnd: rawGrid.gridEnd,
    todayIso: today,
    interactionStart: today,
    scrollAnchorDate,
  };
}

export function effectiveCalendarBounds(
  startDate: string,
  endDate: string,
  timezone: string,
  anchorDate?: string | null,
): { tripStart: string; tripEnd: string; usingDefaultRange: boolean } {
  if (!tripDatesAreUnset(startDate, endDate)) {
    return { tripStart: startDate, tripEnd: endDate, usingDefaultRange: false };
  }

  const anchor = anchorDate?.trim() || todayIso(timezone);
  const start = weekStartMonday(DateTime.fromISO(anchor));
  const end = start.plus({ weeks: SETUP_CALENDAR_WEEKS }).minus({ days: 1 });

  return {
    tripStart: start.toISODate()!,
    tripEnd: end.toISODate()!,
    usingDefaultRange: true,
  };
}

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

/** Ensure every date in the visible grid has a day row for the calendar. */
export function ensureDaysForRange(
  days: DayPlaceDraft[],
  gridStart: string,
  gridEnd: string,
): DayPlaceDraft[] {
  const byDate = new Map(days.map((d) => [d.date, d]));
  const out: DayPlaceDraft[] = [];
  let cursor = gridStart;
  while (cursor <= gridEnd) {
    out.push(byDate.get(cursor) ?? emptyDay(cursor));
    cursor = addDays(cursor, 1);
  }
  return out;
}
