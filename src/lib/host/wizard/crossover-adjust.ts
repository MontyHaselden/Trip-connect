import type { DayPlaceDraft } from "./types";

const DEFAULT_HALF_SHARE = 0.5;

function addDays(iso: string, delta: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}
const SLIDE_FORWARD_THRESHOLD = 0.65;
const SLIDE_BACKWARD_THRESHOLD = 0.35;

export const DIVIDER_SLIDE_FORWARD_SHARE = 0.9;
export const DIVIDER_SLIDE_BACKWARD_SHARE = 0.1;

function emptyHalf(day: DayPlaceDraft): "left" | "right" | null {
  const primary = day.primaryCity.trim();
  const secondary = day.secondaryCity?.trim() ?? "";
  const share = day.primaryShare ?? 1;
  if (primary && !secondary && share < 1) return "right";
  if (!primary && secondary && share < 1) return "left";
  return null;
}

function dayIsEmpty(day: DayPlaceDraft): boolean {
  return !day.primaryCity.trim() && !day.secondaryCity?.trim();
}

function blankDay(date: string): DayPlaceDraft {
  return {
    date,
    primaryCity: "",
    secondaryCity: null,
    primaryShare: 1,
    dayType: "trip",
    includeBuffer: false,
  };
}

function dayAt(days: DayPlaceDraft[], date: string): DayPlaceDraft {
  return days.find((d) => d.date === date) ?? blankDay(date);
}

function dayIsEmptyOrMissing(days: DayPlaceDraft[], date: string): boolean {
  const row = days.find((d) => d.date === date);
  return !row || dayIsEmpty(row);
}

/** Apply patches and insert rows for dates not yet in the list. */
function mergeDayUpdates(
  days: DayPlaceDraft[],
  updates: Record<string, Partial<DayPlaceDraft>>,
): DayPlaceDraft[] {
  const byDate = new Map(days.map((d) => [d.date, d]));
  for (const [date, patch] of Object.entries(updates)) {
    const existing = byDate.get(date) ?? blankDay(date);
    byDate.set(date, { ...existing, ...patch, date });
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

function isFullSingleCityDay(day: DayPlaceDraft): string | null {
  const primary = day.primaryCity.trim();
  const secondary = day.secondaryCity?.trim() ?? "";
  const share = day.primaryShare ?? 1;
  if (secondary) return null;
  if (primary && share >= 1) return primary;
  return null;
}

function citiesDiffer(a: string, b: string): boolean {
  return norm(a) !== norm(b);
}

export type TripPlaceContext = {
  startDate: string;
  endDate: string;
  departureCity: string;
  returnCity: string;
};

export type CrossoverDragOptions = {
  flightDepartureDates?: Set<string>;
  flightArrivalDates?: Set<string>;
  skipEndHomeLock?: boolean;
};

function norm(city: string): string {
  return city.trim().toLowerCase();
}

/** Crossover between two trip locations (not home departure/return halves). */
export function isLocationCrossover(
  day: DayPlaceDraft,
  trip: TripPlaceContext,
): boolean {
  if (day.dayType === "buffer" || !day.secondaryCity?.trim()) return false;

  const dep = norm(trip.departureCity);
  const ret = norm(trip.returnCity);
  const primary = norm(day.primaryCity);
  const secondary = norm(day.secondaryCity);

  if (day.date === trip.startDate && primary === dep) return false;
  if (day.date === trip.endDate && secondary === ret) return false;

  return Boolean(primary && secondary);
}

/** Last day of a stay — city on the left, empty right half. */
export function isStayDepartureEdge(day: DayPlaceDraft, trip: TripPlaceContext): boolean {
  if (day.dayType === "buffer" || isHomeLockedDay(day, trip)) return false;
  return emptyHalf(day) === "right" && Boolean(day.primaryCity.trim());
}

/** First day of a stay — empty left half, city on the right. */
export function isStayArrivalEdge(day: DayPlaceDraft, trip: TripPlaceContext): boolean {
  if (day.dayType === "buffer" || isHomeLockedDay(day, trip)) return false;
  return emptyHalf(day) === "left" && Boolean(day.secondaryCity?.trim());
}

/** Full stay day whose next day carries the same city's departure half — edge slid forward. */
export function isStayEndExtendedDay(
  day: DayPlaceDraft,
  days: DayPlaceDraft[],
  trip: TripPlaceContext,
): boolean {
  if (day.dayType === "buffer" || isHomeLockedDay(day, trip)) return false;
  const city = isFullSingleCityDay(day);
  if (!city) return false;
  const nextDate = addDays(day.date, 1);
  if (nextDate > trip.endDate) return false;
  const next = dayAt(days, nextDate);
  if (!isStayDepartureEdge(next, trip)) return false;
  return !citiesDiffer(city, next.primaryCity);
}

/** Full destination day after a crossover slid onto the previous day — drag back to restore. */
export function isCrossoverDestinationDay(
  day: DayPlaceDraft,
  days: DayPlaceDraft[],
  trip: TripPlaceContext,
): boolean {
  if (day.dayType === "buffer" || isHomeLockedDay(day, trip)) return false;
  const city = isFullSingleCityDay(day);
  if (!city) return false;
  const prevDate = addDays(day.date, -1);
  if (prevDate < trip.startDate) return false;
  const prev = days.find((d) => d.date === prevDate);
  if (!prev || !isLocationCrossover(prev, trip)) return false;
  return !citiesDiffer(prev.secondaryCity ?? "", city);
}

/** Grip position for divider drag — may differ from primaryShare after sliding an edge. */
export function dividerDragAnchorShare(
  day: DayPlaceDraft,
  days: DayPlaceDraft[],
  trip: TripPlaceContext,
): number {
  if (isStayEndExtendedDay(day, days, trip)) return 0.95;
  if (isCrossoverDestinationDay(day, days, trip)) return 0.05;
  return day.primaryShare ?? 1;
}

export function isDividerDraggable(
  day: DayPlaceDraft,
  trip: TripPlaceContext,
  options?: { blockFlightEdges?: boolean; days?: DayPlaceDraft[] },
): boolean {
  const primary = day.primaryCity.trim();
  const secondary = day.secondaryCity?.trim() ?? "";
  if (primary && secondary && !citiesDiffer(primary, secondary)) return false;
  if (isLocationCrossover(day, trip)) return true;
  if (options?.blockFlightEdges) return false;
  if (isStayDepartureEdge(day, trip) || isStayArrivalEdge(day, trip)) return true;
  const allDays = options?.days;
  if (!allDays) return false;
  return (
    isStayEndExtendedDay(day, allDays, trip) ||
    isCrossoverDestinationDay(day, allDays, trip)
  );
}

export function isHomeLockedDay(day: DayPlaceDraft, trip: TripPlaceContext): boolean {
  if (day.dayType === "buffer") return true;
  if (day.date === trip.startDate) return true;
  if (day.date === trip.endDate) return true;
  return false;
}

export function applyCrossoverDrag(
  days: DayPlaceDraft[],
  date: string,
  requestedShare: number,
  trip: TripPlaceContext,
  options?: CrossoverDragOptions,
): DayPlaceDraft[] {
  const day = days.find((d) => d.date === date);
  if (!day) return days;

  const crossover = isLocationCrossover(day, trip);
  const departureEdge = isStayDepartureEdge(day, trip);
  const arrivalEdge = isStayArrivalEdge(day, trip);
  const extendedEnd = isStayEndExtendedDay(day, days, trip);
  const crossoverDest = isCrossoverDestinationDay(day, days, trip);
  if (!crossover && !departureEdge && !arrivalEdge && !extendedEnd && !crossoverDest) {
    return days;
  }

  let next = days;
  if (requestedShare >= SLIDE_FORWARD_THRESHOLD) {
    if (crossover) next = slideCrossoverForward(next, date, trip);
    else if (departureEdge) next = slideStayEndForward(next, date, trip);
    else if (extendedEnd) next = slideStayEndForward(next, addDays(date, 1), trip);
    else if (arrivalEdge) next = slideStayStartForward(next, date, trip);
  } else if (requestedShare <= SLIDE_BACKWARD_THRESHOLD) {
    if (crossover) next = slideCrossoverBackward(next, date, trip);
    else if (departureEdge) next = slideStayEndBackward(next, date, trip);
    else if (extendedEnd) next = slideStayEndRetract(next, date, trip);
    else if (crossoverDest) next = slideCrossoverRestoreForward(next, date, trip);
    else if (arrivalEdge) next = slideStayStartBackward(next, date, trip);
  }

  return enforceHomeLocks(
    next,
    trip,
    options?.flightDepartureDates,
    options?.flightArrivalDates,
    options?.skipEndHomeLock,
  );
}

function slideCrossoverForward(
  days: DayPlaceDraft[],
  date: string,
  trip: TripPlaceContext,
): DayPlaceDraft[] {
  const nextDate = addDays(date, 1);
  if (nextDate > trip.endDate) return days;

  const current = days.find((d) => d.date === date);
  if (!current?.secondaryCity) return days;

  const fromCity = current.primaryCity;
  const toCity = current.secondaryCity;
  const next = days.find((d) => d.date === nextDate);
  const nextCity = next ? isFullSingleCityDay(next) : null;

  if (next && nextCity && citiesDiffer(nextCity, toCity)) return days;

  return mergeDayUpdates(days, {
    [date]: {
      secondaryCity: null,
      primaryShare: 1,
      dayType: date === trip.endDate ? "return" : "trip",
    },
    [nextDate]: {
      primaryCity: fromCity,
      secondaryCity: toCity,
      primaryShare: DEFAULT_HALF_SHARE,
      dayType: "travel",
    },
  });
}

function slideCrossoverBackward(
  days: DayPlaceDraft[],
  date: string,
  trip: TripPlaceContext,
): DayPlaceDraft[] {
  const prevDate = addDays(date, -1);
  if (prevDate < trip.startDate) return days;

  const current = days.find((d) => d.date === date);
  if (!current?.secondaryCity) return days;

  const fromCity = current.primaryCity;
  const toCity = current.secondaryCity;
  const prev = days.find((d) => d.date === prevDate);
  const prevFullFromCity =
    prev &&
    isFullSingleCityDay(prev) &&
    !citiesDiffer(isFullSingleCityDay(prev)!, fromCity);

  if (prev && !prevFullFromCity && !dayIsEmpty(prev)) {
    const prevCity = isFullSingleCityDay(prev);
    if (prevCity && citiesDiffer(prevCity, fromCity)) return days;
  }

  return mergeDayUpdates(days, {
    [date]: {
      primaryCity: toCity,
      secondaryCity: null,
      primaryShare: 1,
      dayType: date === trip.endDate ? "return" : "trip",
    },
    [prevDate]: {
      primaryCity: fromCity,
      secondaryCity: toCity,
      primaryShare: DEFAULT_HALF_SHARE,
      dayType: "travel",
    },
  });
}

function slideStayEndForward(
  days: DayPlaceDraft[],
  date: string,
  trip: TripPlaceContext,
): DayPlaceDraft[] {
  const current = days.find((d) => d.date === date);
  if (!current) return days;
  const city = current.primaryCity.trim();
  if (!city || current.secondaryCity?.trim()) return days;

  const nextDate = addDays(date, 1);
  if (nextDate > trip.endDate) return days;
  const next = dayAt(days, nextDate);

  const nextCity = isFullSingleCityDay(next);
  if (nextCity && citiesDiffer(nextCity, city)) {
    return mergeDayUpdates(days, {
      [date]: {
        primaryShare: 1,
        secondaryCity: null,
        dayType: date === trip.endDate ? "return" : "trip",
      },
      [nextDate]: {
        primaryCity: city,
        secondaryCity: nextCity,
        primaryShare: DEFAULT_HALF_SHARE,
        dayType: "travel",
      },
    });
  }

  if (!dayIsEmpty(next)) return days;

  return mergeDayUpdates(days, {
    [date]: {
      primaryShare: 1,
      secondaryCity: null,
      dayType: date === trip.endDate ? "return" : "trip",
    },
    [nextDate]: {
      primaryCity: city,
      secondaryCity: null,
      primaryShare: DEFAULT_HALF_SHARE,
      dayType: nextDate === trip.endDate ? "return" : "trip",
    },
  });
}

function slideStayEndBackward(
  days: DayPlaceDraft[],
  date: string,
  trip: TripPlaceContext,
): DayPlaceDraft[] {
  const current = days.find((d) => d.date === date);
  if (!current) return days;
  const city = current.primaryCity.trim();
  if (!city || current.secondaryCity?.trim()) return days;

  const prevDate = addDays(date, -1);
  if (prevDate < trip.startDate) return days;

  return mergeDayUpdates(days, {
    [date]: {
      primaryCity: "",
      secondaryCity: null,
      primaryShare: 1,
      dayType: "trip",
    },
    [prevDate]: {
      primaryCity: city,
      secondaryCity: null,
      primaryShare: DEFAULT_HALF_SHARE,
      dayType: prevDate === trip.endDate ? "return" : "trip",
    },
  });
}

function slideStayEndRetract(
  days: DayPlaceDraft[],
  date: string,
  trip: TripPlaceContext,
): DayPlaceDraft[] {
  const current = days.find((d) => d.date === date);
  if (!current) return days;
  const city = isFullSingleCityDay(current);
  if (!city) return days;

  const nextDate = addDays(date, 1);
  if (nextDate > trip.endDate) return days;
  const next = dayAt(days, nextDate);
  if (!isStayDepartureEdge(next, trip) || citiesDiffer(city, next.primaryCity)) return days;

  return mergeDayUpdates(days, {
    [date]: {
      primaryCity: city,
      secondaryCity: null,
      primaryShare: DEFAULT_HALF_SHARE,
      dayType: date === trip.endDate ? "return" : "trip",
    },
    [nextDate]: {
      primaryCity: "",
      secondaryCity: null,
      primaryShare: 1,
      dayType: nextDate === trip.endDate ? "return" : "trip",
    },
  });
}

function slideCrossoverRestoreForward(
  days: DayPlaceDraft[],
  date: string,
  trip: TripPlaceContext,
): DayPlaceDraft[] {
  const prevDate = addDays(date, -1);
  if (prevDate < trip.startDate) return days;
  const prev = days.find((d) => d.date === prevDate);
  if (!prev || !isLocationCrossover(prev, trip)) return days;
  return slideCrossoverForward(days, prevDate, trip);
}

function slideStayStartBackward(
  days: DayPlaceDraft[],
  date: string,
  trip: TripPlaceContext,
): DayPlaceDraft[] {
  const current = days.find((d) => d.date === date);
  if (!current) return days;
  const city = current.secondaryCity?.trim();
  if (!city || current.primaryCity.trim()) return days;

  const prevDate = addDays(date, -1);
  if (prevDate < trip.startDate) return days;
  if (!dayIsEmptyOrMissing(days, prevDate)) return days;

  return mergeDayUpdates(days, {
    [date]: {
      primaryCity: city,
      secondaryCity: null,
      primaryShare: 1,
      dayType: date === trip.endDate ? "return" : "trip",
    },
    [prevDate]: {
      primaryCity: "",
      secondaryCity: city,
      primaryShare: DEFAULT_HALF_SHARE,
      dayType: "travel",
    },
  });
}

function slideStayStartForward(
  days: DayPlaceDraft[],
  date: string,
  trip: TripPlaceContext,
): DayPlaceDraft[] {
  const current = days.find((d) => d.date === date);
  if (!current) return days;
  const city = current.secondaryCity?.trim();
  if (!city || current.primaryCity.trim()) return days;

  const nextDate = addDays(date, 1);
  if (nextDate > trip.endDate) return days;

  return mergeDayUpdates(days, {
    [date]: {
      primaryCity: "",
      secondaryCity: null,
      primaryShare: 1,
      dayType: "trip",
    },
    [nextDate]: {
      primaryCity: "",
      secondaryCity: city,
      primaryShare: DEFAULT_HALF_SHARE,
      dayType: "travel",
    },
  });
}

export function enforceHomeLocks(
  days: DayPlaceDraft[],
  trip: TripPlaceContext,
  flightDepartureDates?: Set<string>,
  flightArrivalDates?: Set<string>,
  skipEndHomeLock?: boolean,
): DayPlaceDraft[] {
  const dep = trip.departureCity.trim();
  const ret = trip.returnCity.trim();
  const bufferBefore = addDays(trip.startDate, -1);

  return days.map((d) => {
    if (d.date === bufferBefore && dep) {
      return {
        ...d,
        primaryCity: dep,
        secondaryCity: null,
        primaryShare: 1,
        dayType: "buffer" as const,
      };
    }
    if (d.date > trip.endDate && d.dayType === "buffer") {
      if (flightArrivalDates?.has(d.date)) {
        return {
          ...d,
          primaryCity: "",
          secondaryCity: null,
          primaryShare: 1,
          dayType: "buffer" as const,
        };
      }
      if (ret) {
        return {
          ...d,
          primaryCity: ret,
          secondaryCity: null,
          primaryShare: 1,
          dayType: "buffer" as const,
        };
      }
    }
    if (d.date === trip.startDate && dep && !flightDepartureDates?.has(d.date)) {
      const dest = d.secondaryCity?.trim() || (norm(d.primaryCity) !== norm(dep) ? d.primaryCity : "");
      if (dest && norm(dest) !== norm(dep)) {
        return {
          ...d,
          primaryCity: dep,
          secondaryCity: dest,
          primaryShare: DEFAULT_HALF_SHARE,
          dayType: "travel" as const,
        };
      }
      return {
        ...d,
        primaryCity: dep,
        secondaryCity: null,
        primaryShare: DEFAULT_HALF_SHARE,
        dayType: "trip" as const,
      };
    }
    if (
      d.date === trip.endDate &&
      ret &&
      !flightDepartureDates?.has(d.date) &&
      !skipEndHomeLock
    ) {
      const dest = norm(d.primaryCity) !== norm(ret) ? d.primaryCity : "";
      if (dest && d.secondaryCity && norm(d.secondaryCity) === norm(ret)) {
        return {
          ...d,
          primaryCity: dest,
          secondaryCity: ret,
          primaryShare: DEFAULT_HALF_SHARE,
          dayType: "return" as const,
        };
      }
      if (dest) {
        return {
          ...d,
          primaryCity: dest,
          secondaryCity: ret,
          primaryShare: DEFAULT_HALF_SHARE,
          dayType: "return" as const,
        };
      }
      return {
        ...d,
        primaryCity: ret,
        secondaryCity: null,
        primaryShare: DEFAULT_HALF_SHARE,
        dayType: "return" as const,
      };
    }
    return d;
  });
}

function findDraggableDividerDate(
  days: DayPlaceDraft[],
  trip: TripPlaceContext,
  aroundDate: string,
  forward: boolean,
  blockFlightEdgesAt?: (date: string) => boolean,
): string | null {
  const offsets = forward ? [1, 0, 2, -1] : [-1, 0, -2, 1];
  for (const delta of offsets) {
    const date = addDays(aroundDate, delta);
    const day = days.find((d) => d.date === date);
    if (!day) continue;
    if (
      isDividerDraggable(day, trip, {
        days,
        blockFlightEdges: blockFlightEdgesAt?.(date),
      })
    ) {
      return date;
    }
  }
  return null;
}

/** Slide a divider toward the hovered day — one or more day steps in a single update. */
export function slideDividerTowardHoverDate(
  days: DayPlaceDraft[],
  dragDate: string,
  hoverDate: string,
  trip: TripPlaceContext,
  options?: CrossoverDragOptions & {
    blockFlightEdgesAt?: (date: string) => boolean;
  },
): { days: DayPlaceDraft[]; dragDate: string } {
  if (!hoverDate || hoverDate === dragDate) return { days, dragDate };

  let current = days;
  let cursor = dragDate;
  const forward = hoverDate > dragDate;
  let steps = 0;

  while (forward ? cursor < hoverDate : cursor > hoverDate) {
    if (steps++ > 62) break;

    const day = current.find((d) => d.date === cursor);
    if (
      !day ||
      !isDividerDraggable(day, trip, {
        days: current,
        blockFlightEdges: options?.blockFlightEdgesAt?.(cursor),
      })
    ) {
      break;
    }

    const share = forward ? DIVIDER_SLIDE_FORWARD_SHARE : DIVIDER_SLIDE_BACKWARD_SHARE;
    const next = applyCrossoverDrag(current, cursor, share, trip, options);
    if (next === current) break;

    current = next;
    const nextCursor = findDraggableDividerDate(
      current,
      trip,
      cursor,
      forward,
      options?.blockFlightEdgesAt,
    );
    if (!nextCursor) break;
    cursor = nextCursor;
  }

  return { days: current, dragDate: cursor };
}
