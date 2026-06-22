import { DAY_TYPES, type DayPlaceDraft, type DayType } from "@/lib/host/wizard/types";
import { stayCityLabel } from "@/lib/host/setup/accommodation-calendar";
import { DEFAULT_HALF_SHARE, locationsMatch } from "@/lib/host/wizard/location-stays";
import type { AccommodationStayDraft } from "@/lib/host/wizard/types";

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

/** Fix empty-morning + city-on-right when it should be a departure half (city on left). */
export function repairMisplacedSecondaryHalfDay(
  day: DayPlaceDraft,
  stays: AccommodationStayDraft[],
): DayPlaceDraft {
  const primary = day.primaryCity.trim();
  const secondary = day.secondaryCity?.trim() ?? "";
  const share = day.primaryShare ?? 1;

  if (primary || !secondary || share >= 0.99 || day.dayType === "travel") {
    return day;
  }

  const isCheckInAfternoon = stays.some(
    (stay) =>
      stay.name?.trim() &&
      stay.checkInDate === day.date &&
      locationsMatch(stayCityLabel(stay), secondary),
  );
  if (isCheckInAfternoon) return day;

  return {
    ...day,
    primaryCity: secondary,
    secondaryCity: null,
    primaryShare: share < 0.99 ? share : DEFAULT_HALF_SHARE,
  };
}

/** Collapse invalid split days produced by old load-time enforcement. */
export function repairCorruptDayPlace(
  day: DayPlaceDraft,
  stays: AccommodationStayDraft[],
): DayPlaceDraft {
  let repaired = repairMisplacedSecondaryHalfDay(day, stays);
  const primary = repaired.primaryCity.trim();
  const secondary = repaired.secondaryCity?.trim() ?? "";

  if (primary && secondary && locationsMatch(primary, secondary)) {
    return {
      ...repaired,
      primaryCity: primary,
      secondaryCity: null,
      primaryShare: 1,
      dayType: repaired.dayType === "travel" ? "trip" : repaired.dayType,
    };
  }

  return repaired;
}

export function repairMisplacedSecondaryHalfDays(
  dayPlaces: DayPlaceDraft[],
  stays: AccommodationStayDraft[],
): DayPlaceDraft[] {
  return dayPlaces.map((day) => repairCorruptDayPlace(day, stays));
}
