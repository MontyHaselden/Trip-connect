import { DAY_TYPES, type DayPlaceDraft, type DayType } from "@/lib/host/wizard/types";

const VALID_DAY_TYPES = new Set<string>(DAY_TYPES);

export function sanitizeDayType(value: unknown): DayType {
  if (typeof value === "string" && VALID_DAY_TYPES.has(value)) {
    return value as DayType;
  }
  return "trip";
}

export function sanitizeDayPlaceDraft(
  day: Partial<DayPlaceDraft> & { date: string },
): DayPlaceDraft {
  return {
    date: day.date,
    primaryCity: typeof day.primaryCity === "string" ? day.primaryCity : "",
    secondaryCity:
      typeof day.secondaryCity === "string"
        ? day.secondaryCity
        : day.secondaryCity === null
          ? null
          : null,
    primaryShare:
      typeof day.primaryShare === "number" && Number.isFinite(day.primaryShare)
        ? day.primaryShare
        : 1,
    dayType: sanitizeDayType(day.dayType),
    includeBuffer: Boolean(day.includeBuffer),
  };
}

/** AI often sends only changed days — merge onto the existing calendar instead of replacing it. */
export function mergeSetDayPlacesDays(
  existing: DayPlaceDraft[],
  incoming: DayPlaceDraft[],
): DayPlaceDraft[] {
  if (!incoming.length) return existing;
  if (!existing.length || incoming.length >= existing.length) {
    return incoming.map(sanitizeDayPlaceDraft);
  }
  const byDate = new Map(existing.map((day) => [day.date, day]));
  for (const day of incoming) {
    byDate.set(day.date, sanitizeDayPlaceDraft(day));
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}
