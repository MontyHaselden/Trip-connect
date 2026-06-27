import {
  DEFAULT_HALF_SHARE,
  enumerateDates,
  locationsMatch,
} from "@/lib/host/wizard/location-stays";
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

function isIncompleteSplit(day: DayPlaceDraft): boolean {
  const primary = day.primaryCity.trim();
  const secondary = day.secondaryCity?.trim() ?? "";
  const share = day.primaryShare ?? 1;
  if (share >= 0.99) return false;
  return Boolean((primary && !secondary) || (!primary && secondary));
}

function isCompleteSplit(day: DayPlaceDraft): boolean {
  const primary = day.primaryCity.trim();
  const secondary = day.secondaryCity?.trim() ?? "";
  const share = day.primaryShare ?? 1;
  return share < 0.99 && Boolean(primary && secondary);
}

function departureCity(day: DayPlaceDraft): string {
  return day.primaryCity.trim();
}

function arrivalCity(day: DayPlaceDraft): string {
  const secondary = day.secondaryCity?.trim() ?? "";
  if (secondary) return secondary;
  return day.primaryCity.trim();
}

/** Full single-city day inside a stay — do not bridge corridor paint across these. */
function isSolidStayDay(day: DayPlaceDraft, city: string): boolean {
  const primary = day.primaryCity.trim();
  const secondary = day.secondaryCity?.trim() ?? "";
  const share = day.primaryShare ?? 1;
  return locationsMatch(primary, city) && !secondary && share >= 0.99;
}

/** Connect half-painted checkout/check-in days using neighbouring cities. */
export function fillIncompleteSplitDays(days: DayPlaceDraft[]): DayPlaceDraft[] {
  if (days.length < 2) return days;

  const byDate = new Map(days.map((day) => [day.date, { ...day }]));
  const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date));

  for (let i = 0; i < sorted.length; i++) {
    const date = sorted[i]!.date;
    const day = byDate.get(date)!;
    if (!isIncompleteSplit(day)) continue;

    const primary = day.primaryCity.trim();
    const secondary = day.secondaryCity?.trim() ?? "";
    const share = day.primaryShare ?? DEFAULT_HALF_SHARE;

    if (primary && !secondary) {
      for (let j = i + 1; j < sorted.length; j++) {
        const nextDay = byDate.get(sorted[j]!.date)!;
        if (isSolidStayDay(nextDay, primary)) {
          byDate.set(date, {
            ...day,
            primaryCity: primary,
            secondaryCity: null,
            primaryShare: 1,
            dayType: day.dayType === "buffer" ? "buffer" : "trip",
          });
          break;
        }
        const nextCity = arrivalCity(nextDay);
        if (!nextCity || locationsMatch(nextCity, primary)) continue;
        // Do not extend a half-day into the prior evening when the next day is a full stay there.
        if (isSolidStayDay(nextDay, nextCity)) continue;
        byDate.set(date, {
          ...day,
          secondaryCity: nextCity,
          primaryShare: share,
          dayType: "trip",
        });
        break;
      }
      continue;
    }

    if (!primary && secondary) {
      for (let j = i - 1; j >= 0; j--) {
        const prevDay = byDate.get(sorted[j]!.date)!;
        if (isSolidStayDay(prevDay, secondary)) break;
        const prevCity = departureCity(prevDay);
        if (!prevCity || locationsMatch(prevCity, secondary)) continue;
        byDate.set(date, {
          ...day,
          primaryCity: prevCity,
          primaryShare: share,
          dayType: "trip",
        });
        break;
      }
    }
  }

  return sorted.map((day) => byDate.get(day.date)!);
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

  const resolved = enumerateDates(gridStart, gridEnd).map((date) => {
    const stored = storedByDate.get(date);
    const derived = derivedByDate.get(date);

    if (preferStored && stored && dayHasPaint(stored)) {
      if (isIncompleteSplit(stored) && derived && dayHasPaint(derived)) {
        if (isCompleteSplit(derived)) return derived;
        const storedPrimary = stored.primaryCity.trim();
        const derivedPrimary = derived.primaryCity.trim();
        const derivedSecondary = derived.secondaryCity?.trim() ?? "";
        const derivedShare = derived.primaryShare ?? 1;
        if (
          storedPrimary &&
          !stored.secondaryCity?.trim() &&
          derivedShare >= 0.99 &&
          derivedPrimary &&
          locationsMatch(derivedPrimary, storedPrimary) &&
          !derivedSecondary
        ) {
          return derived;
        }
      }
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

  return fillIncompleteSplitDays(resolved);
}
