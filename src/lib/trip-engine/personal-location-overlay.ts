import type { DayPlaceDraft } from "@/lib/host/wizard/types";
import { enumerateDates } from "@/lib/host/wizard/location-stays";

import type { NightPairSelection } from "@/lib/host/setup/night-pair-selection";
import type { TripSetupState } from "@/lib/host/setup/types";

import { locationsMatch } from "@/lib/host/wizard/location-stays";

import { clearAllLocationInSpan } from "./paint-day-range";
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
  return mergeMainWithPersonalOverlayDays(graph.mainGroupId, graph.dayPlacesByGroupId, groupId);
}

function mergeMainWithPersonalOverlayDays(
  mainGroupId: string,
  dayPlacesByGroupId: Record<string, DayPlaceDraft[]>,
  groupId: string,
): DayPlaceDraft[] {
  const mainDays = dayPlacesByGroupId[mainGroupId] ?? [];
  const overlayDays = dayPlacesByGroupId[groupId] ?? [];
  const byDate = new Map(mainDays.map((day) => [day.date, day]));
  const overlayByDate = new Map(overlayDays.map((day) => [day.date, day]));
  for (const [date, overlayDay] of overlayByDate) {
    if (dayHasPaint(overlayDay)) {
      byDate.set(date, overlayDay);
      continue;
    }
    // Blank overlay entry masks inherited main paint for this date.
    byDate.set(date, { ...overlayDay, primaryCity: "", secondaryCity: null, primaryShare: 1 });
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function isPersonalOverlayGroup(state: TripSetupState, groupId: string): boolean {
  const group = state.groups?.find((g) => g.id === groupId);
  return Boolean(group?.personalForParticipantId && group.inheritMode === "overlay");
}

function emptyOverlayDay(date: string): DayPlaceDraft {
  return {
    date,
    primaryCity: "",
    secondaryCity: null,
    primaryShare: 1,
    dayType: "trip",
    includeBuffer: false,
  };
}

/** Clear inherited main paint for a personal overlay group and return the stored delta. */
export function clearPersonalOverlayLocationInSpan(
  state: TripSetupState,
  groupId: string,
  selection: NightPairSelection,
): DayPlaceDraft[] {
  const mainDays = state.dayPlacesByGroupId[state.mainGroupId] ?? [];
  const existingOverlay = state.dayPlacesByGroupId[groupId] ?? [];
  const merged = mergeMainWithPersonalOverlayDays(
    state.mainGroupId,
    state.dayPlacesByGroupId,
    groupId,
  );
  const clearedMerged = clearAllLocationInSpan(merged, selection);
  const end = selection.rangeEnd || selection.rangeStart;
  const delta = extractPersonalLocationOverlayDelta(
    mainDays,
    clearedMerged,
    existingOverlay,
    selection.rangeStart,
    end,
  );

  const mainByDate = new Map(mainDays.map((day) => [day.date, day]));
  const isFullRangeClear =
    (selection.startHalf ?? "full") === "full" && (selection.endHalf ?? "full") === "full";

  const deltaByDate = new Map(delta.map((day) => [day.date, day]));
  if (isFullRangeClear) {
    for (const date of enumerateDates(selection.rangeStart, end)) {
      const mainDay = mainByDate.get(date);
      if (!mainDay || !dayHasPaint(mainDay)) continue;
      deltaByDate.set(date, emptyOverlayDay(date));
    }
  }

  return dedupeDaysByDate([...deltaByDate.values()]);
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

function shouldOmitOverlayDate(
  mainDay: DayPlaceDraft | undefined,
  paintedDay: DayPlaceDraft,
  rangeStart: string,
  rangeEnd: string,
): boolean {
  if (!mainDay || !isTravelSplitDay(mainDay)) return false;
  if (isTravelSplitDay(paintedDay)) return false;
  const paintedPrimary = paintedDay.primaryCity.trim();
  const mainPrimary = mainDay.primaryCity.trim();
  if (paintedPrimary && !locationsMatch(paintedPrimary, mainPrimary)) return false;
  const end = rangeEnd || rangeStart;
  // Same primary as main corridor — corridor replacement handles display on that edge.
  if (rangeStart !== end) return true;
  return false;
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
    if (shouldOmitOverlayDate(mainDay, paintedDay, rangeStart, end)) continue;

    const normalized = mainDay ? repairOverlayTravelDay(mainDay, paintedDay) : paintedDay;
    if (mainDay && daysLocationEqual(normalized, mainDay)) continue;

    delta.push(normalized);
  }

  return dedupeDaysByDate(delta);
}
