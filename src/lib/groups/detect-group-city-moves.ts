import { detectCityMoves, type CityMove } from "@/lib/host/wizard/detect-city-moves";
import { mergeGroupDayPlaces } from "@/lib/groups/resolve-layers";
import type { PublishedGroupDayPlace } from "@/types/published-trip";
import type { DayPlaceDraft } from "@/lib/host/wizard/types";

export function resolvedDayPlacesForGroup(
  mainPlaces: DayPlaceDraft[],
  groupPlaces: DayPlaceDraft[],
  isMain: boolean,
): DayPlaceDraft[] {
  if (isMain) return mainPlaces;
  const mainPublished: PublishedGroupDayPlace[] = mainPlaces.map((d, i) => ({
    id: `main-${d.date}`,
    groupId: "main",
    date: d.date,
    primaryCity: d.primaryCity,
    secondaryCity: d.secondaryCity,
    primaryShare: d.primaryShare,
    dayType: d.dayType,
    calendarLabel: null,
    weatherLocationQuery: null,
  }));
  const groupPublished: PublishedGroupDayPlace[] = groupPlaces.map((d) => ({
    id: `g-${d.date}`,
    groupId: "group",
    date: d.date,
    primaryCity: d.primaryCity,
    secondaryCity: d.secondaryCity,
    primaryShare: d.primaryShare,
    dayType: d.dayType,
    calendarLabel: null,
    weatherLocationQuery: null,
  }));
  const merged = mergeGroupDayPlaces(mainPublished, groupPublished, new Set(["group"]));
  return [...merged.values()]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(
      (p): DayPlaceDraft => ({
        date: p.date,
        primaryCity: p.primaryCity,
        secondaryCity: p.secondaryCity,
        primaryShare: p.primaryShare,
        dayType: (p.dayType ?? "trip") as DayPlaceDraft["dayType"],
        includeBuffer: false,
      }),
    );
}

export function detectGroupCityMoves(
  mainPlaces: DayPlaceDraft[],
  groupPlaces: DayPlaceDraft[],
  isMain: boolean,
): CityMove[] {
  const resolved = resolvedDayPlacesForGroup(mainPlaces, groupPlaces, isMain);
  return detectCityMoves(resolved);
}

export function intercityPromptForMove(move: CityMove): string {
  return `How is the group getting from ${move.fromCity} to ${move.toCity} on ${move.date}?`;
}
