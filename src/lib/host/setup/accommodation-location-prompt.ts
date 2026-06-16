import { mainAccommodationStays } from "@/lib/host/setup/entity-scope";
import { resolvedMainDayPlaces } from "@/lib/host/setup/resolved-day-places";
import {
  stayCoversNight,
  stayRelevantToSelection,
} from "@/lib/host/setup/day-selection-setup";
import type { TripSetupState } from "@/lib/host/setup/types";
import { cityOnHalf, locationsMatch } from "@/lib/host/wizard/location-stays";
import type { HalfSide } from "@/lib/host/wizard/location-stays";
import type { AccommodationStayDraft, DayPlaceDraft } from "@/lib/host/wizard/types";

function inRange(date: string, start: string, end: string): boolean {
  const e = end || start;
  return date >= start && date <= e;
}

function dayHasLocationPaint(day: DayPlaceDraft): boolean {
  return Boolean(day.primaryCity.trim() || day.secondaryCity?.trim());
}

/** Day places derived from named stays — matches what the setup calendar displays. */
export function effectiveDayPlacesForLocationCheck(
  state: TripSetupState,
  _rangeStart: string,
  _rangeEnd: string,
): DayPlaceDraft[] {
  return resolvedMainDayPlaces(state);
}

function dayLocationCountsForAccommodationSave(
  date: string,
  days: DayPlaceDraft[],
  namedStays: AccommodationStayDraft[],
  rangeStart: string,
  rangeEnd: string,
): boolean {
  const day = days.find((d) => d.date === date);
  if (!day || !dayHasLocationPaint(day)) return false;

  const coveringStay = namedStays.find((s) => stayCoversNight(s, date));
  if (coveringStay) {
    return stayRelevantToSelection(coveringStay, rangeStart, rangeEnd);
  }

  const checkoutMorningStay = namedStays.find(
    (s) => s.name?.trim() && s.checkOutDate === date && s.checkInDate < date,
  );
  if (checkoutMorningStay) {
    return stayRelevantToSelection(checkoutMorningStay, rangeStart, rangeEnd);
  }

  return true;
}

export function currentDayLocationLabel(
  days: DayPlaceDraft[],
  rangeStart: string,
  rangeEnd: string,
  half: HalfSide | "full",
): string {
  const end = rangeEnd || rangeStart;
  if (half !== "full" && rangeStart === end) {
    const day = days.find((d) => d.date === rangeStart);
    if (!day || !dayHasLocationPaint(day)) return "";
    return cityOnHalf(day, half).trim();
  }

  const painted = days.filter(
    (d) => inRange(d.date, rangeStart, end) && dayHasLocationPaint(d),
  );
  if (!painted.length) return "";

  return locationLabelsFromDays(painted);
}

function locationLabelsFromDays(days: DayPlaceDraft[]): string {
  const labels = new Set<string>();
  for (const day of days) {
    const primary = day.primaryCity.trim();
    const secondary = day.secondaryCity?.trim() ?? "";
    if (primary) labels.add(primary);
    if (secondary) labels.add(secondary);
  }
  const cities = [...labels];
  if (cities.length === 1) return cities[0]!;
  if (cities.length > 1) return cities.join(" → ");
  return "";
}

/** Location label for save prompt — ignores checkout-edge paint from earlier stays. */
export function currentAccommodationLocationLabel(
  state: TripSetupState,
  rangeStart: string,
  rangeEnd: string,
  half: HalfSide | "full",
): string {
  const end = rangeEnd || rangeStart;
  const effectiveDays = effectiveDayPlacesForLocationCheck(state, rangeStart, end);
  const namedStays = mainAccommodationStays(state).filter((s) => s.name?.trim());

  if (half !== "full" && rangeStart === end) {
    if (!dayLocationCountsForAccommodationSave(rangeStart, effectiveDays, namedStays, rangeStart, end)) {
      return "";
    }
    return currentDayLocationLabel(effectiveDays, rangeStart, end, half);
  }

  const painted = effectiveDays.filter(
    (d) =>
      inRange(d.date, rangeStart, end) &&
      dayLocationCountsForAccommodationSave(d.date, effectiveDays, namedStays, rangeStart, end),
  );
  if (!painted.length) return "";

  return locationLabelsFromDays(painted);
}

export type LocationConflict = {
  current: string;
  proposed: string;
};

export function accommodationLocationConflict(
  current: string,
  proposed: string,
): LocationConflict | null {
  const cur = current.trim();
  const next = proposed.trim();
  if (!cur || !next) return null;
  if (locationsMatch(cur, next)) return null;
  return { current: cur, proposed: next };
}

export type DayLocationChoice =
  | { mode: "keep"; cityLabel?: string }
  | { mode: "apply" }
  | { mode: "custom"; label: string };
