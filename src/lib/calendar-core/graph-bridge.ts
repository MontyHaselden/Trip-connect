import type { HalfSide } from "@/lib/host/wizard/location-stays";
import type { DayPlaceDraft } from "@/lib/host/wizard/types";

import {
  dayPlaceToSlice,
  dayPlacesToSlices,
  extractOverrides,
  mergeOverrides,
  paintRange,
  setDaysFromLegacy,
  slicesToDayPlaces,
} from "@/lib/calendar-core";
import { halfSideToSelection } from "@/lib/calendar-core/half-map";
import type { HalfSelection } from "@/lib/calendar-core";
import { stripPlaceholderDayPlaces } from "@/lib/host/setup/placeholder-city";
import { personalGroupForGroupId } from "@/lib/trip-engine/person-lens";
import type { TripEntityGraph } from "@/lib/trip-engine/types";

export { halfSideToSelection };

export function paintDayRangeForGroup(
  graph: TripEntityGraph,
  groupId: string,
  rangeStart: string,
  rangeEnd: string,
  location: string,
  startHalf: HalfSide | "full" = "full",
  endHalf: HalfSide | "full" = "full",
): DayPlaceDraft[] {
  const end = rangeEnd || rangeStart;
  const personal = personalGroupForGroupId(graph, groupId);
  const mainSlices = dayPlacesToSlices(graph.dayPlacesByGroupId[graph.mainGroupId] ?? []);
  const groupSlices = dayPlacesToSlices(graph.dayPlacesByGroupId[groupId] ?? []);
  const selStart = halfSideToSelection(startHalf);
  const selEnd = halfSideToSelection(endHalf);
  const options = { transitionContextSlices: mainSlices };

  if (!personal || personal.inheritMode === "independent") {
    const painted = paintRange(groupSlices, rangeStart, end, location, selStart, selEnd, options);
    return slicesToDayPlaces(painted);
  }

  const base = mergeOverrides(mainSlices, groupSlices, "override");
  const painted = paintRange(base, rangeStart, end, location, selStart, selEnd, options);
  return slicesToDayPlaces(extractOverrides(mainSlices, painted));
}

export function setDayPlacesForGroup(
  graph: TripEntityGraph,
  groupId: string,
  days: DayPlaceDraft[],
): DayPlaceDraft[] {
  const cleaned = stripPlaceholderDayPlaces(days);
  const personal = personalGroupForGroupId(graph, groupId);
  const mainSlices = dayPlacesToSlices(graph.dayPlacesByGroupId[graph.mainGroupId] ?? []);
  const groupSlices = dayPlacesToSlices(graph.dayPlacesByGroupId[groupId] ?? []);

  if (!personal || personal.inheritMode === "independent") {
    return slicesToDayPlaces(setDaysFromLegacy(groupSlices, cleaned));
  }

  const personalFull = cleaned.map(dayPlaceToSlice);
  return slicesToDayPlaces(extractOverrides(mainSlices, personalFull));
}
