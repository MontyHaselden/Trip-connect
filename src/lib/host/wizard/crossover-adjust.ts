import type { DayPlaceDraft } from "./types";

const DEFAULT_HALF_SHARE = 0.5;

function addDays(iso: string, delta: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}
const SLIDE_FORWARD_THRESHOLD = 0.65;
const SLIDE_BACKWARD_THRESHOLD = 0.35;

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

export function isDividerDraggable(
  day: DayPlaceDraft,
  trip: TripPlaceContext,
  options?: { blockFlightEdges?: boolean },
): boolean {
  if (isLocationCrossover(day, trip)) return true;
  if (options?.blockFlightEdges) return false;
  return isStayDepartureEdge(day, trip) || isStayArrivalEdge(day, trip);
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
  if (!crossover && !departureEdge && !arrivalEdge) return days;

  let next = days;
  if (requestedShare >= SLIDE_FORWARD_THRESHOLD) {
    if (crossover) next = slideCrossoverForward(next, date, trip);
    else if (departureEdge) next = slideStayEndForward(next, date, trip);
    else if (arrivalEdge) next = slideStayStartForward(next, date, trip);
  } else if (requestedShare <= SLIDE_BACKWARD_THRESHOLD) {
    if (crossover) next = slideCrossoverBackward(next, date, trip);
    else if (departureEdge) next = slideStayEndBackward(next, date, trip);
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

  return days.map((d) => {
    if (d.date === date) {
      return {
        ...d,
        secondaryCity: null,
        primaryShare: 1,
        dayType: date === trip.endDate ? ("return" as const) : ("trip" as const),
      };
    }
    if (d.date === nextDate) {
      return {
        ...d,
        primaryCity: fromCity,
        secondaryCity: toCity,
        primaryShare: DEFAULT_HALF_SHARE,
        dayType: "travel" as const,
      };
    }
    return d;
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

  return days.map((d) => {
    if (d.date === date) {
      return {
        ...d,
        primaryCity: toCity,
        secondaryCity: null,
        primaryShare: 1,
        dayType: date === trip.endDate ? ("return" as const) : ("trip" as const),
      };
    }
    if (d.date === prevDate) {
      return {
        ...d,
        primaryCity: fromCity,
        secondaryCity: toCity,
        primaryShare: DEFAULT_HALF_SHARE,
        dayType: "travel" as const,
      };
    }
    return d;
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
  const next = days.find((d) => d.date === nextDate);
  if (!next) return days;

  const nextCity = isFullSingleCityDay(next);
  if (nextCity && citiesDiffer(nextCity, city)) {
    return days.map((d) => {
      if (d.date === date) {
        return {
          ...d,
          primaryShare: 1,
          secondaryCity: null,
          dayType: date === trip.endDate ? ("return" as const) : ("trip" as const),
        };
      }
      if (d.date === nextDate) {
        return {
          ...d,
          primaryCity: city,
          secondaryCity: nextCity,
          primaryShare: DEFAULT_HALF_SHARE,
          dayType: "travel" as const,
        };
      }
      return d;
    });
  }

  if (!dayIsEmpty(next)) return days;

  return days.map((d) => {
    if (d.date === date) {
      return {
        ...d,
        primaryShare: 1,
        secondaryCity: null,
        dayType: date === trip.endDate ? ("return" as const) : ("trip" as const),
      };
    }
    if (d.date === nextDate) {
      return {
        ...d,
        primaryCity: city,
        secondaryCity: null,
        primaryShare: DEFAULT_HALF_SHARE,
        dayType: nextDate === trip.endDate ? ("return" as const) : ("trip" as const),
      };
    }
    return d;
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

  return days.map((d) => {
    if (d.date === date) {
      return { ...d, primaryCity: "", secondaryCity: null, primaryShare: 1, dayType: "trip" as const };
    }
    if (d.date === prevDate) {
      return {
        ...d,
        primaryCity: city,
        secondaryCity: null,
        primaryShare: DEFAULT_HALF_SHARE,
        dayType: prevDate === trip.endDate ? ("return" as const) : ("trip" as const),
      };
    }
    return d;
  });
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
  const prev = days.find((d) => d.date === prevDate);
  if (!prev || !dayIsEmpty(prev)) return days;

  return days.map((d) => {
    if (d.date === date) {
      return {
        ...d,
        primaryCity: city,
        secondaryCity: null,
        primaryShare: 1,
        dayType: date === trip.endDate ? ("return" as const) : ("trip" as const),
      };
    }
    if (d.date === prevDate) {
      return {
        ...d,
        primaryCity: "",
        secondaryCity: city,
        primaryShare: DEFAULT_HALF_SHARE,
        dayType: "travel" as const,
      };
    }
    return d;
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

  return days.map((d) => {
    if (d.date === date) {
      return { ...d, primaryCity: "", secondaryCity: null, primaryShare: 1, dayType: "trip" as const };
    }
    if (d.date === nextDate) {
      return {
        ...d,
        primaryCity: "",
        secondaryCity: city,
        primaryShare: DEFAULT_HALF_SHARE,
        dayType: "travel" as const,
      };
    }
    return d;
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
