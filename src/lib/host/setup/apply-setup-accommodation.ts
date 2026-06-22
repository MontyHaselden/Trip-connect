import {
  applyStaysToDayPlaces,
  coalesceAdjacentNamedStays,
} from "@/lib/host/setup/accommodation-calendar";
import {
  groupAccommodationStays,
  mainAccommodationStays,
  mergeAccommodationStays,
} from "@/lib/host/setup/entity-scope";
import {
  syncTransportLegAllocation,
  unallocateLegsForStayRange,
} from "@/lib/host/setup/transport-allocation";
import { syncTripBoundsFromContent } from "@/lib/host/setup/sync-trip-bounds";
import type { TripSetupState } from "@/lib/host/setup/types";

/** Repaint calendar stays and re-derive trip dates after accommodation edits. */
export function applySetupAccommodationChange(
  state: TripSetupState,
  groupId: string,
  options?: { replaceStayIds?: Set<string> },
): TripSetupState {
  const isMain = groupId === state.mainGroupId;
  const stays = isMain
    ? mainAccommodationStays(state)
    : groupAccommodationStays(state, groupId);
  const coalescedStays = coalesceAdjacentNamedStays(stays);
  const namedStays = coalescedStays.filter((s) => s.name?.trim());
  const storedDays = state.dayPlacesByGroupId[groupId] ?? [];
  const replaceStayIds = options?.replaceStayIds;

  let next: TripSetupState = {
    ...state,
    accommodationStays: mergeAccommodationStays(state, groupId, coalescedStays),
    dayPlacesByGroupId: {
      ...state.dayPlacesByGroupId,
      [groupId]: applyStaysToDayPlaces(storedDays, namedStays, replaceStayIds ? { replaceStayIds } : undefined),
    },
  };

  if (replaceStayIds?.size) {
    for (const stay of namedStays) {
      if (replaceStayIds.has(stay.id)) {
        next = unallocateLegsForStayRange(next, groupId, stay);
      }
    }
    next = syncTransportLegAllocation(next, groupId, { checkConflicts: true });
  } else {
    next = syncTransportLegAllocation(next, groupId);
  }
  return syncTripBoundsFromContent(next);
}
