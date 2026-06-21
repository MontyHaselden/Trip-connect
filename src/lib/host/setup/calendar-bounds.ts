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
  activityDates?: string[];
  /** Used when trip dates are unset and no painted content exists yet. */
  fallbackAnchor?: string;
};

function collectContentDates(input: CalendarScrollAnchorInput): string[] {
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

  for (const iso of input.activityDates ?? []) {
    if (isMeaningfulCalendarDate(iso)) dates.push(iso);
  }

  return dates;
}

/** Earliest on-trip content day — skips pre-trip buffer / outbound-only dates before startDate. */
function earliestOnTripContentDate(
  input: CalendarScrollAnchorInput,
  dates: string[],
): string | null {
  if (!dates.length) return null;
  const sorted = [...dates].sort();
  if (!tripDatesAreUnset(input.startDate, input.endDate)) {
    const onTrip = sorted.filter((d) => d >= input.startDate && d <= input.endDate);
    if (onTrip.length) return onTrip[0]!;
    return input.startDate;
  }
  return sorted[0]!;
}

/** Scroll to the earliest day with trip content — not today, not mid-trip. */
export function resolveCalendarScrollAnchor(input: CalendarScrollAnchorInput): string {
  const earliest = earliestOnTripContentDate(input, collectContentDates(input));
  if (earliest) return earliest;

  if (!tripDatesAreUnset(input.startDate, input.endDate)) {
    return input.startDate;
  }

  return input.fallbackAnchor?.trim() || todayIso(input.timezone);
}

/** Scroll target for the Trip OS grid. */
export function visibleCalendarScrollAnchor(input: CalendarScrollAnchorInput): string {
  const target = resolveCalendarScrollAnchor(input);
  const today = todayIso(input.timezone);

  if (!tripDatesAreUnset(input.startDate, input.endDate)) {
    if (input.endDate < today) {
      return input.startDate;
    }
    if (input.startDate < today) {
      return target;
    }
  }

  if (target >= today) return target;

  const dates = collectContentDates(input).sort();
  const onTripVisible = dates.filter((d) => {
    if (d < today) return false;
    if (!tripDatesAreUnset(input.startDate, input.endDate)) {
      return d >= input.startDate && d <= input.endDate;
    }
    return true;
  });
  if (onTripVisible.length) return onTripVisible[0]!;

  if (!tripDatesAreUnset(input.startDate, input.endDate) && input.startDate >= today) {
    return input.startDate;
  }

  return today;
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
  activityDates?: string[];
};

/** Host calendar grid — full padded scroll range when trip dates are set; new trips start at today. */
export function calendarGridFromToday(input: CalendarGridFromTodayInput): {
  gridStart: string;
  gridEnd: string;
  todayIso: string;
  interactionStart: string;
  scrollAnchorDate: string;
} {
  const today = todayIso(input.timezone);
  const scrollAnchorDate = visibleCalendarScrollAnchor({
    startDate: input.startDate,
    endDate: input.endDate,
    timezone: input.timezone,
    dayPlaces: input.dayPlaces,
    accommodationStays: input.accommodationStays,
    transportDates: input.transportDates,
    activityDates: input.activityDates,
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

  const gridStart = datesSet
    ? rawGrid.gridStart
    : todayMonday > scrollMonday
      ? todayMonday.toISODate()!
      : rawGrid.gridStart;

  const interactionStart = datesSet ? rawGrid.gridStart : today;

  return {
    gridStart,
    gridEnd: rawGrid.gridEnd,
    todayIso: today,
    interactionStart,
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
