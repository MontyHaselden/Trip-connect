import {
  applyStaysToDayPlaces,
  coalesceAdjacentNamedStays,
} from "@/lib/host/setup/accommodation-calendar";
import { overlayStoredHostLocations } from "@/lib/host/setup/derive-calendar";
import {
  groupAccommodationStays,
  mainAccommodationStays,
  mergeAccommodationStays,
} from "@/lib/host/setup/entity-scope";
import { syncTripBoundsFromContent } from "@/lib/host/setup/sync-trip-bounds";
import type { TripSetupState } from "@/lib/host/setup/types";

/** Repaint calendar stays and re-derive trip dates after accommodation edits. */
export function applySetupAccommodationChange(
  state: TripSetupState,
  groupId: string,
): TripSetupState {
  const isMain = groupId === state.mainGroupId;
  const stays = isMain
    ? mainAccommodationStays(state)
    : groupAccommodationStays(state, groupId);
  const coalescedStays = coalesceAdjacentNamedStays(stays);
  const namedStays = coalescedStays.filter((s) => s.name?.trim());
  const storedDays = state.dayPlacesByGroupId[groupId] ?? [];
  const repainted = overlayStoredHostLocations(
    applyStaysToDayPlaces(storedDays, namedStays),
    storedDays,
    namedStays,
  );

  const next: TripSetupState = {
    ...state,
    accommodationStays: mergeAccommodationStays(state, groupId, coalescedStays),
    dayPlacesByGroupId: {
      ...state.dayPlacesByGroupId,
      [groupId]: repainted,
    },
  };

  return syncTripBoundsFromContent(next);
}
