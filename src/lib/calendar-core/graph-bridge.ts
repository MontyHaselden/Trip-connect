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
import { groupAccommodationStays } from "@/lib/host/setup/entity-scope";
import { enforceContentHalfDayBoundaries } from "@/lib/host/setup/enforce-content-half-days";
import { graphToSetupState } from "@/lib/trip-engine/adapters";
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
  const storedSlices = dayPlacesToSlices(graph.dayPlacesByGroupId[groupId] ?? []);

  if (!personal || personal.inheritMode === "independent") {
    return slicesToDayPlaces(setDaysFromLegacy(storedSlices, cleaned));
  }

  const projected = mergeOverrides(mainSlices, storedSlices, "override");
  const updated = setDaysFromLegacy(projected, cleaned);
  return slicesToDayPlaces(extractOverrides(mainSlices, updated));
}

/** Run stay/location half-day rules on a projected personal calendar, then store sparse overrides. */
export function enforcePersonalOverlayDayPlaces(
  graph: TripEntityGraph,
  groupId: string,
  sparseOverrides: DayPlaceDraft[],
): DayPlaceDraft[] {
  const mainSlices = dayPlacesToSlices(graph.dayPlacesByGroupId[graph.mainGroupId] ?? []);
  const storedSlices = dayPlacesToSlices(sparseOverrides);
  const projected = slicesToDayPlaces(mergeOverrides(mainSlices, storedSlices, "override"));
  const trip = {
    startDate: graph.basics.startDate,
    endDate: graph.basics.endDate,
    departureCity: graph.basics.departureCity,
    returnCity: graph.basics.returnCity,
  };
  const stays = groupAccommodationStays(graphToSetupState(graph), groupId);
  const enforced = enforceContentHalfDayBoundaries(projected, trip, stays);
  const enforcedSlices = dayPlacesToSlices(enforced);
  return slicesToDayPlaces(extractOverrides(mainSlices, enforcedSlices));
}
