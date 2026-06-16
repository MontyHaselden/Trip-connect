import {
  applyStaysToDayPlaces,
  coalesceAdjacentNamedStays,
} from "@/lib/host/setup/accommodation-calendar";
import { applySetupTransportChange } from "@/lib/host/setup/apply-setup-transport";
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
  const days = state.dayPlacesByGroupId[groupId] ?? [];
  const repainted = applyStaysToDayPlaces(days, namedStays).filter(
    (d) => d.primaryCity.trim() || d.secondaryCity?.trim(),
  );

  let next: TripSetupState = {
    ...state,
    accommodationStays: mergeAccommodationStays(state, groupId, coalescedStays),
    dayPlacesByGroupId: {
      ...state.dayPlacesByGroupId,
      [groupId]: repainted,
    },
  };

  if (isMain) {
    next = applySetupTransportChange(next, { intercityLegs: next.intercityLegs });
  }

  return syncTripBoundsFromContent(next);
}
