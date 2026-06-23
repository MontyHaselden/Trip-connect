import { trimConflictingStaysForLocationPaint } from "@/lib/host/setup/remove-accommodation-range";
import { enumerateDates, type HalfSide } from "@/lib/host/wizard/location-stays";
import type { DayPlaceDraft } from "@/lib/host/wizard/types";

import type { TripEntityGraph } from "./types";

/** A calendar day painted with two cities (half-day split). Not tied to transport. */
export function isTravelSplitDay(day: DayPlaceDraft): boolean {
  const primary = day.primaryCity.trim();
  const secondary = day.secondaryCity?.trim() ?? "";
  const share = day.primaryShare ?? 1;
  return Boolean(primary && secondary && share < 0.99);
}

export const isCitySplitDay = isTravelSplitDay;

/** Restore city split days at range edges that full-range paint would flatten. */
export function protectTravelSplitDays(
  originals: Map<string, DayPlaceDraft>,
  painted: DayPlaceDraft[],
  rangeStart: string,
  rangeEnd: string,
  startHalf: HalfSide | "full" = "full",
  endHalf: HalfSide | "full" = "full",
): DayPlaceDraft[] {
  const end = rangeEnd || rangeStart;
  const byDate = new Map(painted.map((day) => [day.date, day]));

  for (const date of enumerateDates(rangeStart, end)) {
    const original = originals.get(date);
    if (!original || !isTravelSplitDay(original)) continue;

    if (rangeStart === end) {
      if (startHalf === "left" || startHalf === "right") continue;
      byDate.set(date, { ...original });
      continue;
    }

    if (date === rangeStart && startHalf === "right") continue;
    if (date === end && endHalf === "left") continue;

    if (date === rangeStart || date === end) {
      byDate.set(date, { ...original });
    }
  }

  return [...byDate.values()]
    .filter((day) => day.primaryCity.trim() || day.secondaryCity?.trim())
    .sort((a, b) => a.date.localeCompare(b.date));
}

function scopedStays(graph: TripEntityGraph, groupId: string) {
  return graph.accommodationStays.filter((stay) =>
    groupId === graph.mainGroupId
      ? !stay.originGroupId || stay.originGroupId === graph.mainGroupId
      : stay.originGroupId === groupId,
  );
}

/** True when painting would trim or reshape accommodation stays in the range. */
export function wouldReplanLocationRange(
  graph: TripEntityGraph,
  groupId: string,
  rangeStart: string,
  rangeEnd: string,
  location: string,
  _startHalf: HalfSide | "full" = "full",
  _endHalf: HalfSide | "full" = "full",
): boolean {
  const end = rangeEnd || rangeStart;
  const loc = location.trim();
  const stays = scopedStays(graph, groupId);
  const trimmed = trimConflictingStaysForLocationPaint(stays, loc, rangeStart, end);

  if (trimmed.length !== stays.length) return true;
  for (let i = 0; i < stays.length; i++) {
    const before = stays[i]!;
    const after = trimmed[i];
    if (!after) return true;
    if (
      before.checkInDate !== after.checkInDate ||
      before.checkOutDate !== after.checkOutDate ||
      before.cityLabel !== after.cityLabel
    ) {
      return true;
    }
  }

  return false;
}
