import { locationsMatch } from "@/lib/host/wizard/location-stays";
import {
  stayNamesMatch,
  stayRangesOverlap,
} from "@/lib/trip-engine/match-main-accommodation-stay";
import type { TripEntityGraph } from "../types";

type StayLike = {
  id: string;
  name?: string | null;
  cityLabel: string;
  checkInDate: string;
  checkOutDate: string;
  originGroupId?: string | null;
};

/** Same hotel booking leg — name + city + overlapping nights. */
export function isSameFinanceAccommodationLeg(a: StayLike, b: StayLike): boolean {
  if (!a.name?.trim() || !b.name?.trim()) return false;
  if (!stayNamesMatch(a.name, b.name)) return false;
  if (!locationsMatch(a.cityLabel, b.cityLabel)) return false;
  return stayRangesOverlap(a, b);
}

function isMainGroupStay(graph: TripEntityGraph, stay: StayLike): boolean {
  return !stay.originGroupId || stay.originGroupId === graph.mainGroupId;
}

/** Main-group stay that shares a finance leg with this stay, if any. */
export function matchingMainStayForFinanceLeg(
  graph: TripEntityGraph,
  stay: StayLike,
): StayLike | null {
  if (isMainGroupStay(graph, stay)) return null;
  for (const main of graph.accommodationStays) {
    if (!isMainGroupStay(graph, main)) continue;
    if (!main.name?.trim()) continue;
    if (isSameFinanceAccommodationLeg(stay, main)) return main;
  }
  return null;
}

/** Named stays that should each get one finance row (personal duplicates of main legs excluded). */
export function financeSeedAccommodationStays(
  graph: TripEntityGraph,
): TripEntityGraph["accommodationStays"] {
  const named = graph.accommodationStays.filter((s) => s.name?.trim());
  const skipIds = new Set<string>();
  for (const stay of named) {
    if (isMainGroupStay(graph, stay)) continue;
    if (matchingMainStayForFinanceLeg(graph, stay)) {
      skipIds.add(stay.id);
    }
  }
  return named.filter((s) => !skipIds.has(s.id));
}

/** Personal stay ids that duplicate a main-group finance leg (extra cost rows to remove). */
export function duplicatePersonalStayIdsForFinance(
  graph: TripEntityGraph,
): Set<string> {
  const ids = new Set<string>();
  for (const stay of graph.accommodationStays) {
    if (!stay.name?.trim()) continue;
    if (isMainGroupStay(graph, stay)) continue;
    if (matchingMainStayForFinanceLeg(graph, stay)) {
      ids.add(stay.id);
    }
  }
  return ids;
}
