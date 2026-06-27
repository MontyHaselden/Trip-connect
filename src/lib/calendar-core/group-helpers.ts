import { enumerateDates } from "@/lib/host/wizard/location-stays";
import type { DayPlaceDraft } from "@/lib/host/wizard/types";
import type { NightPairSelection } from "@/lib/host/setup/night-pair-selection";
import type { TripSetupState } from "@/lib/host/setup/types";

import {
  clearRange,
  dayPlacesToSlices,
  extractOverrides,
  mergeOverrides,
  slicesToDayPlaces,
} from "./index";

export function isPersonalOverlayGroup(state: TripSetupState, groupId: string): boolean {
  const group = state.groups?.find((g) => g.id === groupId);
  return Boolean(group?.personalForParticipantId && group.inheritMode !== "independent");
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

/** Clear location paint for a personal overlay group and return stored override rows. */
export function clearPersonalOverlayLocationInSpan(
  state: TripSetupState,
  groupId: string,
  selection: NightPairSelection,
): DayPlaceDraft[] {
  const mainSlices = dayPlacesToSlices(state.dayPlacesByGroupId[state.mainGroupId] ?? []);
  const existingSlices = dayPlacesToSlices(state.dayPlacesByGroupId[groupId] ?? []);
  const end = selection.rangeEnd || selection.rangeStart;
  const merged = mergeOverrides(mainSlices, existingSlices, "override");
  const cleared = clearRange(merged, selection);
  const delta = extractOverrides(mainSlices, cleared);

  const isFullRangeClear =
    (selection.startHalf ?? "full") === "full" && (selection.endHalf ?? "full") === "full";

  const deltaByDate = new Map(delta.map((slice) => [slice.date, slice]));
  if (isFullRangeClear) {
    const mainByDate = new Map(mainSlices.map((slice) => [slice.date, slice]));
    for (const date of enumerateDates(selection.rangeStart, end)) {
      const mainDay = mainByDate.get(date);
      if (!mainDay || (!mainDay.amCity.trim() && !mainDay.pmCity.trim())) continue;
      deltaByDate.set(date, { date, amCity: "", pmCity: "", dayType: "trip" });
    }
  }

  const keptOutside = existingSlices.filter(
    (slice) => slice.date < selection.rangeStart || slice.date > end,
  );
  const keptDays = slicesToDayPlaces(keptOutside);
  const deltaDays = slicesToDayPlaces([...deltaByDate.values()]);
  const byDate = new Map<string, DayPlaceDraft>();
  for (const day of keptDays) byDate.set(day.date, day);
  for (const day of deltaDays) {
    if (day.primaryCity.trim() || day.secondaryCity?.trim()) {
      byDate.set(day.date, day);
    } else {
      byDate.set(day.date, emptyOverlayDay(day.date));
    }
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function projectedDayPlacesForGroup(
  mainDays: DayPlaceDraft[],
  groupDays: DayPlaceDraft[],
  mode: "inherit" | "independent" | "overlay",
): DayPlaceDraft[] {
  const mainSlices = dayPlacesToSlices(mainDays);
  const groupSlices = dayPlacesToSlices(groupDays);
  if (mode === "independent") return slicesToDayPlaces(groupSlices);
  if (mode === "inherit") return slicesToDayPlaces(mainSlices);
  return slicesToDayPlaces(mergeOverrides(mainSlices, groupSlices, "override"));
}
