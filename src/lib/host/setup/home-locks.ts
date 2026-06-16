import { locationsMatch } from "@/lib/host/wizard/location-stays";
import type { DayPlaceDraft } from "@/lib/host/wizard/types";

const DEFAULT_HALF_SHARE = 0.5;

function addDays(iso: string, delta: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

function norm(city: string): string {
  return city.trim().toLowerCase();
}

export type TripPlaceContext = {
  startDate: string;
  endDate: string;
  departureCity: string;
  returnCity: string;
};

/** Crossover between two trip locations (not home departure/return halves). */
export function isLocationCrossover(day: DayPlaceDraft, trip: TripPlaceContext): boolean {
  if (day.dayType === "buffer" || !day.secondaryCity?.trim()) return false;

  const dep = norm(trip.departureCity);
  const ret = norm(trip.returnCity);
  const primary = norm(day.primaryCity);
  const secondary = norm(day.secondaryCity);

  if (day.date === trip.startDate && primary === dep) return false;
  if (day.date === trip.endDate && secondary === ret) return false;

  return Boolean(primary && secondary);
}

export function isHomeLockedDay(day: DayPlaceDraft, trip: TripPlaceContext): boolean {
  if (day.dayType === "buffer") return true;
  if (day.date === trip.startDate) return true;
  if (day.date === trip.endDate) return true;
  return false;
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

  return days.map((d) => {
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
    // Home city on start date is painted by flight crossover — never alone without a departure flight.
    if (d.date === trip.startDate && dep && !flightDepartureDates?.has(d.date)) {
      return d;
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

/** Day before first travel — full day at home before outbound flights. */
export function preTripHomeBufferDate(tripStartDate: string): string {
  return addDays(tripStartDate, -1);
}

/**
 * Full home day after return: day after landing when the flight arrives after endDate,
 * otherwise the day after trip end.
 */
export function postTripHomeBufferDate(
  tripEndDate: string,
  homeArrivalDate?: string | null,
): string {
  if (homeArrivalDate && homeArrivalDate > tripEndDate) {
    return addDays(homeArrivalDate, 1);
  }
  return addDays(tripEndDate, 1);
}

function paintPreTripHomeBufferDay(day: DayPlaceDraft, departureCity: string): DayPlaceDraft {
  const dep = departureCity.trim();
  const primary = day.primaryCity.trim();
  const secondary = day.secondaryCity?.trim() ?? "";

  if (primary && !locationsMatch(primary, dep)) {
    return {
      ...day,
      primaryCity: dep,
      secondaryCity: null,
      primaryShare: 1,
      dayType: "buffer" as const,
    };
  }

  if (primary && secondary) return day;

  if (primary && locationsMatch(primary, dep)) {
    return {
      ...day,
      secondaryCity: null,
      primaryShare: 1,
      dayType: "buffer" as const,
    };
  }

  if (primary) return day;

  return {
    ...day,
    primaryCity: dep,
    secondaryCity: null,
    primaryShare: 1,
    dayType: "buffer" as const,
  };
}

/** Day after trip end = full day back home (return departure is on trip.endDate). */
function paintPostTripHomeBufferDay(
  day: DayPlaceDraft,
  returnCity: string,
): DayPlaceDraft {
  const ret = returnCity.trim();
  const primary = day.primaryCity.trim();
  const secondary = day.secondaryCity?.trim() ?? "";

  if (primary && !locationsMatch(primary, ret)) {
    return {
      ...day,
      primaryCity: ret,
      secondaryCity: null,
      primaryShare: 1,
      dayType: "buffer" as const,
    };
  }

  if (primary && secondary) return day;

  if (primary && locationsMatch(primary, ret)) {
    return {
      ...day,
      secondaryCity: null,
      primaryShare: 1,
      dayType: "buffer" as const,
    };
  }

  if (primary) return day;

  return {
    ...day,
    primaryCity: ret,
    secondaryCity: null,
    primaryShare: 1,
    dayType: "buffer" as const,
  };
}

export function ensurePreTripHomeBuffer(
  days: DayPlaceDraft[],
  trip: TripPlaceContext,
  hasOutboundTransport = true,
): DayPlaceDraft[] {
  const dep = trip.departureCity.trim();
  if (!dep || !hasOutboundTransport) return days;

  const bufferDate = preTripHomeBufferDate(trip.startDate);
  const existing = days.find((d) => d.date === bufferDate) ?? {
    date: bufferDate,
    primaryCity: "",
    secondaryCity: null,
    primaryShare: 1,
    dayType: "trip" as const,
    includeBuffer: false,
  };
  const painted = paintPreTripHomeBufferDay(existing, dep);

  if (!days.some((d) => d.date === bufferDate)) {
    return [...days, painted].sort((a, b) => a.date.localeCompare(b.date));
  }

  return days.map((d) => (d.date === bufferDate ? painted : d));
}

export function ensurePostTripHomeBuffer(
  days: DayPlaceDraft[],
  trip: TripPlaceContext,
  hasReturnTransport = true,
  homeArrivalDate?: string | null,
): DayPlaceDraft[] {
  const ret = trip.returnCity.trim();
  if (!ret || !hasReturnTransport) return days;

  const bufferDate = postTripHomeBufferDate(trip.endDate, homeArrivalDate);
  const existing = days.find((d) => d.date === bufferDate) ?? {
    date: bufferDate,
    primaryCity: "",
    secondaryCity: null,
    primaryShare: 1,
    dayType: "trip" as const,
    includeBuffer: false,
  };
  const painted = paintPostTripHomeBufferDay(existing, ret);

  if (!days.some((d) => d.date === bufferDate)) {
    return [...days, painted].sort((a, b) => a.date.localeCompare(b.date));
  }

  return days.map((d) => (d.date === bufferDate ? painted : d));
}

/** Drop departure-city paint when outbound flights were removed. */
export function clearOrphanOutboundHomePaint(
  days: DayPlaceDraft[],
  trip: TripPlaceContext,
  hasOutboundTransport: boolean,
): DayPlaceDraft[] {
  const dep = trip.departureCity.trim();
  if (!dep || hasOutboundTransport) return days;

  const bufferBefore = addDays(trip.startDate, -1);

  return days.map((day) => {
    const primary = day.primaryCity.trim();
    const secondary = day.secondaryCity?.trim() ?? "";
    const paintsDep =
      (primary && locationsMatch(primary, dep)) ||
      (secondary && locationsMatch(secondary, dep));
    if (!paintsDep) return day;

    if (day.date === bufferBefore) {
      return {
        ...day,
        primaryCity: "",
        secondaryCity: null,
        primaryShare: 1,
        dayType: "trip" as const,
      };
    }

    if (day.date !== trip.startDate) return day;

    if (primary && locationsMatch(primary, dep) && secondary && !locationsMatch(secondary, dep)) {
      return {
        ...day,
        primaryCity: secondary,
        secondaryCity: null,
        primaryShare: 1,
        dayType: "trip" as const,
      };
    }

    if (primary && locationsMatch(primary, dep) && !secondary) {
      return {
        ...day,
        primaryCity: "",
        secondaryCity: null,
        primaryShare: 1,
        dayType: "trip" as const,
      };
    }

    if (secondary && locationsMatch(secondary, dep)) {
      return {
        ...day,
        secondaryCity: null,
        primaryShare: 1,
        dayType: "trip" as const,
      };
    }

    return day;
  });
}

/** Drop return-city paint that only made sense with a return flight. */
export function clearOrphanReturnHomePaint(
  days: DayPlaceDraft[],
  trip: TripPlaceContext,
  hasReturnTransport: boolean,
): DayPlaceDraft[] {
  const ret = trip.returnCity.trim();
  if (!ret || hasReturnTransport) return days;

  return days.map((day) => {
    if (day.date <= trip.endDate) {
      if (
        day.date === trip.endDate &&
        day.secondaryCity?.trim() &&
        locationsMatch(day.secondaryCity, ret)
      ) {
        return {
          ...day,
          secondaryCity: null,
          primaryShare: 1,
          dayType: day.primaryCity.trim() ? ("trip" as const) : day.dayType,
        };
      }
      return day;
    }

    const paintsHome =
      locationsMatch(day.primaryCity, ret) ||
      (day.secondaryCity?.trim() ? locationsMatch(day.secondaryCity, ret) : false);
    if (!paintsHome) return day;

    return {
      ...day,
      primaryCity: "",
      secondaryCity: null,
      primaryShare: 1,
      dayType: "trip" as const,
    };
  });
}
