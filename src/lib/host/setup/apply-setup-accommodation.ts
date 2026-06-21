import {
  applyStaysToDayPlaces,
  coalesceAdjacentNamedStays,
} from "@/lib/host/setup/accommodation-calendar";
import {
  cityChangePaintDate,
  overlayStoredHostLocations,
} from "@/lib/host/setup/derive-calendar";
import {
  groupAccommodationStays,
  groupIntercityLegs,
  mainAccommodationStays,
  mainIntercityLegs,
  mergeAccommodationStays,
} from "@/lib/host/setup/entity-scope";
import { inferDayPlacesFromIntercityLeg } from "@/lib/host/setup-inference";
import { syncTripBoundsFromContent } from "@/lib/host/setup/sync-trip-bounds";
import type { TripSetupState } from "@/lib/host/setup/types";
import type { AccommodationStayDraft, DayPlaceDraft } from "@/lib/host/wizard/types";

/** Apply city-change transport paint before stays so travel-day departures survive check-in. */
function dayPlacesWithTransportInference(
  state: TripSetupState,
  groupId: string,
  storedDays: DayPlaceDraft[],
  namedStays: AccommodationStayDraft[],
): DayPlaceDraft[] {
  const legs =
    groupId === state.mainGroupId
      ? mainIntercityLegs(state)
      : groupIntercityLegs(state, groupId);

  let dayPlaces = [...storedDays];
  const paintedCityChange = new Set<string>();

  for (const leg of legs) {
    if (leg.legKind && leg.legKind !== "city_change") continue;
    const paintDate = cityChangePaintDate(leg, namedStays, dayPlaces);
    if (!paintDate) continue;
    const routeKey = `${leg.intercityFromCity.trim().toLowerCase()}→${leg.intercityToCity.trim().toLowerCase()}`;
    if (paintedCityChange.has(routeKey)) continue;
    paintedCityChange.add(routeKey);
    dayPlaces = inferDayPlacesFromIntercityLeg(
      dayPlaces,
      { ...leg, travelDate: paintDate },
      { stays: namedStays },
    );
  }

  return dayPlaces;
}

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
  const transportBase = dayPlacesWithTransportInference(state, groupId, storedDays, namedStays);
  const mergedBase = overlayStoredHostLocations(transportBase, storedDays, namedStays);
  const repainted = overlayStoredHostLocations(
    applyStaysToDayPlaces(mergedBase, namedStays),
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
