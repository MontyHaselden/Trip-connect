import type { DayPlaceDraft } from "./types";

export type LocationStayDraft = {
  location: string;
  startDate: string;
  endDate: string;
};

export const DEFAULT_HALF_SHARE = 0.5;

export function addDays(iso: string, delta: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

export function enumerateDates(start: string, end: string): string[] {
  if (!start || !end || start > end) return [];
  const out: string[] = [];
  let cur = start;
  while (cur <= end) {
    out.push(cur);
    cur = addDays(cur, 1);
  }
  return out;
}

function shareForDateInRange(date: string, start: string, end: string): number {
  if (start === end) return DEFAULT_HALF_SHARE;
  if (date === start || date === end) return DEFAULT_HALF_SHARE;
  return 1;
}

function cloneDay(day: DayPlaceDraft): DayPlaceDraft {
  return { ...day };
}

function dayMap(days: DayPlaceDraft[]): Map<string, DayPlaceDraft> {
  return new Map(days.map((d) => [d.date, cloneDay(d)]));
}

function inferDayType(
  date: string,
  day: DayPlaceDraft,
  tripStart: string,
  tripEnd: string,
): DayPlaceDraft["dayType"] {
  if (day.dayType === "buffer") return "buffer";
  if (date === tripEnd) return "return";
  if (day.secondaryCity) return "travel";
  if (day.primaryShare < 1 && !day.secondaryCity) {
    if (date === tripStart || date === tripEnd) return date === tripEnd ? "return" : "trip";
    return "travel";
  }
  return "trip";
}

export function applyLocationStays(
  days: DayPlaceDraft[],
  stays: LocationStayDraft[],
  trip: { startDate: string; endDate: string; departureCity: string; returnCity: string },
): DayPlaceDraft[] {
  const map = dayMap(days);
  const bufferBefore = addDays(trip.startDate, -1);
  const bufferAfter = addDays(trip.endDate, 1);

  for (const day of map.values()) {
    if (day.date === bufferBefore && trip.departureCity.trim()) {
      day.primaryCity = trip.departureCity.trim();
      day.secondaryCity = null;
      day.primaryShare = DEFAULT_HALF_SHARE;
      day.dayType = "buffer";
    } else if (day.date === bufferAfter && trip.returnCity.trim()) {
      day.primaryCity = trip.returnCity.trim();
      day.secondaryCity = null;
      day.primaryShare = DEFAULT_HALF_SHARE;
      day.dayType = "buffer";
    } else if (
      day.date >= trip.startDate &&
      day.date <= trip.endDate &&
      day.dayType !== "buffer"
    ) {
      day.primaryCity = "";
      day.secondaryCity = null;
      day.primaryShare = 1;
      day.dayType = day.date === trip.endDate ? "return" : "trip";
    }
  }

  for (const stay of stays) {
    const location = stay.location.trim();
    if (!location) continue;

    for (const date of enumerateDates(stay.startDate, stay.endDate)) {
      const day = map.get(date);
      if (!day || day.dayType === "buffer") continue;

      const share = shareForDateInRange(date, stay.startDate, stay.endDate);
      const existingPrimary = day.primaryCity.trim();

      if (!existingPrimary) {
        day.primaryCity = location;
        day.secondaryCity = null;
        day.primaryShare = share;
      } else if (existingPrimary.toLowerCase() === location.toLowerCase()) {
        day.primaryShare = Math.max(day.primaryShare, share);
      } else {
        day.secondaryCity = location;
        day.primaryShare = DEFAULT_HALF_SHARE;
        day.dayType = "travel";
      }

      day.dayType = inferDayType(date, day, trip.startDate, trip.endDate);
    }
  }

  applyDepartureReturnHalves(map, trip);

  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
}

function applyDepartureReturnHalves(
  map: Map<string, DayPlaceDraft>,
  trip: { startDate: string; endDate: string; departureCity: string; returnCity: string },
) {
  const startDay = map.get(trip.startDate);
  const dep = trip.departureCity.trim();
  if (startDay && dep) {
    const existing = startDay.primaryCity.trim();
    if (!existing) {
      startDay.primaryCity = dep;
      startDay.primaryShare = DEFAULT_HALF_SHARE;
    } else if (existing.toLowerCase() !== dep.toLowerCase()) {
      startDay.secondaryCity = existing;
      startDay.primaryCity = dep;
      startDay.primaryShare = DEFAULT_HALF_SHARE;
      startDay.dayType = "travel";
    }
  }

  const endDay = map.get(trip.endDate);
  const ret = trip.returnCity.trim();
  if (endDay && ret) {
    const existing = endDay.primaryCity.trim();
    if (!existing) {
      endDay.primaryCity = ret;
      endDay.primaryShare = DEFAULT_HALF_SHARE;
      endDay.dayType = "return";
    } else if (existing.toLowerCase() !== ret.toLowerCase()) {
      endDay.secondaryCity = ret;
      endDay.primaryShare = DEFAULT_HALF_SHARE;
      endDay.dayType = endDay.date === trip.endDate ? "return" : "travel";
    }
  }
}

export function inferStaysFromDayPlaces(
  days: DayPlaceDraft[],
  tripStart: string,
  tripEnd: string,
): LocationStayDraft[] {
  const tripDays = days
    .filter((d) => d.date >= tripStart && d.date <= tripEnd && d.primaryCity.trim())
    .sort((a, b) => a.date.localeCompare(b.date));

  const stays: LocationStayDraft[] = [];
  let current: LocationStayDraft | null = null;

  for (const day of tripDays) {
    const city = day.primaryCity.trim();
    if (!city) continue;

    if (!current || current.location.toLowerCase() !== city.toLowerCase()) {
      if (current) stays.push(current);
      current = { location: city, startDate: day.date, endDate: day.date };
    } else {
      current.endDate = day.date;
    }
  }
  if (current) stays.push(current);

  return stays;
}

export function hasUncoveredTripDays(
  days: DayPlaceDraft[],
  tripStart: string,
  tripEnd: string,
): boolean {
  return enumerateDates(tripStart, tripEnd).some((date) => {
    const day = days.find((d) => d.date === date);
    if (!day) return true;
    return !day.primaryCity.trim();
  });
}

export function assignmentLabel(index: number): string {
  const ordinals = ["First", "Second", "Third", "Fourth", "Fifth", "Sixth"];
  const word = ordinals[index] ?? `${index + 1}th`;
  return `${word} location`;
}

export function locationColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue} 55% 88%)`;
}

export function locationBorderColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue} 45% 55%)`;
}
