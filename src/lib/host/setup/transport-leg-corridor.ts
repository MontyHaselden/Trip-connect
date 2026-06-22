import { cityOnHalf, locationsMatch } from "@/lib/host/wizard/location-stays";
import type { DayPlaceDraft } from "@/lib/host/wizard/types";

function dayHasPaint(day: DayPlaceDraft): boolean {
  return Boolean(day.primaryCity.trim() || day.secondaryCity?.trim());
}

/** Day paint matches a travel corridor (from on left half, to on right). */
export function dayMatchesLegCorridor(
  day: DayPlaceDraft,
  from: string,
  to: string,
): boolean {
  if (!dayHasPaint(day)) return false;
  const left = cityOnHalf(day, "left").trim();
  const right = cityOnHalf(day, "right").trim();
  return Boolean(left && right && locationsMatch(left, from) && locationsMatch(right, to));
}

/** User-painted locations block this leg from allocating on this day. */
export function dayConflictsWithLegCorridor(
  day: DayPlaceDraft,
  from: string,
  to: string,
): boolean {
  if (!dayHasPaint(day)) return false;
  if (dayMatchesLegCorridor(day, from, to)) return false;

  const left = cityOnHalf(day, "left").trim();
  const right = cityOnHalf(day, "right").trim();

  if (left && !locationsMatch(left, from) && !locationsMatch(left, to)) return true;
  if (right && !locationsMatch(right, from) && !locationsMatch(right, to)) return true;
  if (left && locationsMatch(left, from) && right && !locationsMatch(right, to)) return true;
  if (right && locationsMatch(right, to) && left && !locationsMatch(left, from)) return true;

  const primary = day.primaryCity.trim();
  const secondary = day.secondaryCity?.trim() ?? "";
  if (primary && !secondary) {
    return !locationsMatch(primary, from) && !locationsMatch(primary, to);
  }
  if (!primary && secondary) {
    return !locationsMatch(secondary, from) && !locationsMatch(secondary, to);
  }

  return !dayMatchesLegCorridor(day, from, to);
}
