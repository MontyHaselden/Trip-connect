import type { DayPlaceDraft } from "@/lib/host/wizard/types";

import { isTravelSplitDay } from "./paint-location-preflight";
import type { TripEntityGraph } from "./types";

function dayHasPaint(day: Pick<DayPlaceDraft, "primaryCity" | "secondaryCity">): boolean {
  return Boolean(day.primaryCity.trim() || day.secondaryCity?.trim());
}

function dedupeDaysByDate(days: DayPlaceDraft[]): DayPlaceDraft[] {
  const byDate = new Map<string, DayPlaceDraft>();
  for (const day of days) {
    byDate.set(day.date, day);
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

function daysLocationEqual(a: DayPlaceDraft, b: DayPlaceDraft): boolean {
  return (
    a.primaryCity.trim() === b.primaryCity.trim() &&
    (a.secondaryCity?.trim() ?? "") === (b.secondaryCity?.trim() ?? "") &&
    (a.primaryShare ?? 1) === (b.primaryShare ?? 1) &&
    a.dayType === b.dayType
  );
}

/** Main plan merged with any existing personal location overrides. */
export function mergeMainWithPersonalOverlay(
  graph: TripEntityGraph,
  groupId: string,
): DayPlaceDraft[] {
  const mainDays = graph.dayPlacesByGroupId[graph.mainGroupId] ?? [];
  const overlayDays = graph.dayPlacesByGroupId[groupId] ?? [];
  const byDate = new Map(mainDays.map((day) => [day.date, day]));
  for (const day of overlayDays) {
    if (dayHasPaint(day)) byDate.set(day.date, day);
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

function repairOverlayTravelDay(
  mainDay: DayPlaceDraft,
  paintedDay: DayPlaceDraft,
): DayPlaceDraft {
  if (!isTravelSplitDay(mainDay) || isTravelSplitDay(paintedDay)) return paintedDay;

  const paintedPrimary = paintedDay.primaryCity.trim();
  const mainPrimary = mainDay.primaryCity.trim();
  if (!paintedPrimary || paintedPrimary === mainPrimary) return paintedDay;

  return {
    ...paintedDay,
    secondaryCity: mainDay.secondaryCity,
    primaryShare: mainDay.primaryShare,
    dayType: mainDay.dayType,
  };
}

function shouldOmitOverlayDate(mainDay: DayPlaceDraft | undefined, paintedDay: DayPlaceDraft): boolean {
  if (!mainDay || !isTravelSplitDay(mainDay)) return false;
  if (isTravelSplitDay(paintedDay)) return false;
  // Full-range paint flattened a corridor day — corridor replacement handles display.
  return true;
}

/**
 * Personal groups store only location deltas vs main. Keeps main logistics intact and
 * avoids flattening travel split days into the overlay store.
 */
export function extractPersonalLocationOverlayDelta(
  mainDays: DayPlaceDraft[],
  paintedDays: DayPlaceDraft[],
  existingOverlay: DayPlaceDraft[],
  rangeStart: string,
  rangeEnd: string,
): DayPlaceDraft[] {
  const end = rangeEnd || rangeStart;
  const mainByDate = new Map(mainDays.map((day) => [day.date, day]));
  const paintedByDate = new Map(paintedDays.map((day) => [day.date, day]));

  const keptOutsideRange = existingOverlay.filter(
    (day) => dayHasPaint(day) && (day.date < rangeStart || day.date > end),
  );

  const delta: DayPlaceDraft[] = [...keptOutsideRange];

  for (const [date, paintedDay] of paintedByDate) {
    if (date < rangeStart || date > end) continue;
    if (!dayHasPaint(paintedDay)) continue;

    const mainDay = mainByDate.get(date);
    if (shouldOmitOverlayDate(mainDay, paintedDay)) continue;

    const normalized = mainDay ? repairOverlayTravelDay(mainDay, paintedDay) : paintedDay;
    if (mainDay && daysLocationEqual(normalized, mainDay)) continue;

    delta.push(normalized);
  }

  return dedupeDaysByDate(delta);
}
