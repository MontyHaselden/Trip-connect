import { enumerateDates } from "@/lib/host/wizard/location-stays";
import type { DayPlaceDraft } from "@/lib/host/wizard/types";

function emptyDayPlace(date: string): DayPlaceDraft {
  return {
    date,
    primaryCity: "",
    secondaryCity: null,
    primaryShare: 1,
    dayType: "trip",
    includeBuffer: false,
  };
}

function dayHasPaint(day: DayPlaceDraft): boolean {
  return Boolean(day.primaryCity.trim() || day.secondaryCity?.trim());
}

/**
 * Prefer graph-stored day paint for display — derive fills gaps between stored edge days.
 * Re-deriving with stored overlay was collapsing half-day edges back to full days.
 */
export function resolveDisplayDayPlaces(
  storedDays: DayPlaceDraft[],
  derivedDays: DayPlaceDraft[],
  gridStart: string,
  gridEnd: string,
): DayPlaceDraft[] {
  const storedByDate = new Map(storedDays.map((d) => [d.date, d]));
  const derivedByDate = new Map(derivedDays.map((d) => [d.date, d]));
  const preferStored = storedDays.some(dayHasPaint);

  return enumerateDates(gridStart, gridEnd).map((date) => {
    const stored = storedByDate.get(date);
    const derived = derivedByDate.get(date);

    if (preferStored && stored && dayHasPaint(stored)) {
      return stored;
    }
    if (derived && dayHasPaint(derived)) {
      return derived;
    }
    if (stored && dayHasPaint(stored)) {
      return stored;
    }
    return stored ?? derived ?? emptyDayPlace(date);
  });
}
