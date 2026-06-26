import { cityOnHalf, locationPaletteKey, locationsMatch } from "@/lib/host/wizard/location-stays";
import type { DayPlaceDraft } from "@/lib/host/wizard/types";

import type { ProjectedDay } from "./types";

function dayHasPaint(day: Pick<DayPlaceDraft, "primaryCity" | "secondaryCity">): boolean {
  return Boolean(day.primaryCity.trim() || day.secondaryCity?.trim());
}

function isTravelSplitDay(day: Pick<ProjectedDay, "primaryCity" | "secondaryCity" | "primaryShare">): boolean {
  const primary = day.primaryCity.trim();
  const secondary = day.secondaryCity?.trim() ?? "";
  const share = day.primaryShare ?? 1;
  return Boolean(primary && secondary && share < 0.99);
}

function fullDayCity(day: Pick<DayPlaceDraft, "primaryCity" | "secondaryCity" | "primaryShare">): string {
  const primary = day.primaryCity.trim();
  const secondary = day.secondaryCity?.trim() ?? "";
  const share = day.primaryShare ?? 1;
  if (primary && !secondary && share >= 0.99) return primary;
  if (!primary && secondary && share >= 0.99) return secondary;
  return "";
}

/** Map main-group city labels to participant replacements on matching dates. */
export function buildParticipantCityReplacements(
  mainDays: ProjectedDay[],
  overlayDays: DayPlaceDraft[],
): Map<string, string> {
  const replacements = new Map<string, string>();
  const mainByDate = new Map(mainDays.map((d) => [d.date, d]));

  for (const overlay of overlayDays) {
    if (!dayHasPaint(overlay)) continue;
    const main = mainByDate.get(overlay.date);
    if (!main) continue;

    const overlayCity = fullDayCity(overlay);
    const mainCity = fullDayCity(main);
    if (!overlayCity || !mainCity || locationsMatch(overlayCity, mainCity)) continue;

    replacements.set(locationPaletteKey(mainCity), overlayCity);
  }

  return replacements;
}

function locationFieldsFromOverlay(overlay: DayPlaceDraft): Pick<
  ProjectedDay,
  "primaryCity" | "secondaryCity" | "primaryShare" | "dayType"
> {
  return {
    primaryCity: overlay.primaryCity,
    secondaryCity: overlay.secondaryCity,
    primaryShare: overlay.primaryShare,
    dayType: overlay.dayType,
  };
}

function toDayPlace(day: Pick<ProjectedDay, "date" | "primaryCity" | "secondaryCity" | "primaryShare" | "dayType">): DayPlaceDraft {
  return {
    date: day.date,
    primaryCity: day.primaryCity,
    secondaryCity: day.secondaryCity,
    primaryShare: day.primaryShare,
    dayType: day.dayType,
    includeBuffer: false,
  };
}

function repairOverlayTravelDay(
  mainDay: ProjectedDay,
  overlay: DayPlaceDraft,
  replacements: Map<string, string>,
): ProjectedDay {
  const primary = overlay.primaryCity.trim();
  const secondary = overlay.secondaryCity?.trim() ?? "";
  const share = overlay.primaryShare ?? 1;

  const corruptDepartureHalf = !primary && Boolean(secondary) && share < 0.99;
  if (!corruptDepartureHalf) {
    return {
      ...mainDay,
      ...locationFieldsFromOverlay(overlay),
      overlayMeta: "override",
    };
  }

  const mainLeft = cityOnHalf(toDayPlace(mainDay), "left").trim();
  const mainRight = cityOnHalf(toDayPlace(mainDay), "right").trim();
  const replacement = replacements.get(locationPaletteKey(mainLeft));
  const arrivalMatchesMain = locationsMatch(secondary, mainRight);

  // Participant cleared the departure half while keeping the main arrival city.
  if (arrivalMatchesMain && !replacement) {
    return {
      ...mainDay,
      ...locationFieldsFromOverlay(overlay),
      overlayMeta: "override",
    };
  }

  return {
    ...mainDay,
    primaryCity: replacement ?? (mainLeft || mainDay.primaryCity),
    secondaryCity: secondary || mainDay.secondaryCity,
    primaryShare: mainDay.primaryShare,
    dayType: mainDay.dayType,
    overlayMeta: "override",
  };
}

function applyTravelCorridorReplacement(
  mainDay: ProjectedDay,
  replacements: Map<string, string>,
): ProjectedDay | null {
  if (!isTravelSplitDay(mainDay)) return null;

  const left = cityOnHalf(toDayPlace(mainDay), "left").trim();
  if (!left) return null;

  const replacement = replacements.get(locationPaletteKey(left));
  if (!replacement || locationsMatch(replacement, left)) return null;

  return {
    ...mainDay,
    primaryCity: replacement,
    overlayMeta: "override",
  };
}

/**
 * Keep main logistics (stays, transport overlays, activities) and only swap location paint
 * for participant-specific city overrides.
 */
export function mergeParticipantLocationOverlay(
  mainDays: ProjectedDay[],
  overlayDays: DayPlaceDraft[],
): ProjectedDay[] {
  const paintedOverlay = overlayDays.filter(dayHasPaint);
  const overlayByDate = new Map(overlayDays.map((d) => [d.date, d]));
  const replacements = buildParticipantCityReplacements(mainDays, paintedOverlay);

  return mainDays.map((mainDay) => {
    const overlay = overlayByDate.get(mainDay.date);
    if (overlay) {
      if (!dayHasPaint(overlay)) {
        return {
          ...mainDay,
          primaryCity: "",
          secondaryCity: null,
          primaryShare: 1,
          dayType: "trip",
          overlayMeta: "override",
        };
      }
      return repairOverlayTravelDay(mainDay, overlay, replacements);
    }

    const travelFix = applyTravelCorridorReplacement(mainDay, replacements);
    if (travelFix) return travelFix;

    return { ...mainDay, overlayMeta: "inherit" as const };
  });
}
