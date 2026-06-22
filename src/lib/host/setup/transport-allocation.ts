import { cityChangePaintDate } from "@/lib/host/setup/derive-calendar";
import {
  groupAccommodationStays,
  groupIntercityLegs,
  mainAccommodationStays,
  mainIntercityLegs,
} from "@/lib/host/setup/entity-scope";
import { metroDisplayLabel } from "@/lib/host/setup/metro-display";
import {
  resolveArrivalStayCity,
  resolveDepartureStayCity,
} from "@/lib/host/setup/resolve-arrival-stay-city";
import { inferDayPlacesFromIntercityLeg } from "@/lib/host/setup-inference";
import {
  dayConflictsWithLegCorridor,
  dayMatchesLegCorridor,
} from "@/lib/host/setup/transport-leg-corridor";
import { locationsMatch } from "@/lib/host/wizard/location-stays";
import type {
  AccommodationStayDraft,
  DayPlaceDraft,
  IntercityLegDraft,
} from "@/lib/host/wizard/types";

import type { TripSetupState } from "./types";
import { enforceGroupHalfDayBoundaries } from "./enforce-content-half-days";

function scopedIntercityLegs(state: TripSetupState, groupId: string): IntercityLegDraft[] {
  return groupId === state.mainGroupId
    ? mainIntercityLegs(state)
    : groupIntercityLegs(state, groupId);
}

function scopedNamedStays(state: TripSetupState, groupId: string): AccommodationStayDraft[] {
  const stays =
    groupId === state.mainGroupId
      ? mainAccommodationStays(state)
      : groupAccommodationStays(state, groupId);
  return stays.filter((s) => s.name?.trim());
}

function dayHasPaint(day: DayPlaceDraft): boolean {
  return Boolean(day.primaryCity.trim() || day.secondaryCity?.trim());
}

/** Resolved corridor labels for an intercity leg on a given date. */
export function resolveLegCorridorCities(
  leg: Pick<IntercityLegDraft, "intercityFromCity" | "intercityToCity">,
  stays: AccommodationStayDraft[],
  date: string,
): { from: string; to: string } | null {
  const from = stays.length
    ? resolveDepartureStayCity(leg.intercityFromCity, stays, date)
    : metroDisplayLabel(leg.intercityFromCity.trim());
  const to = stays.length
    ? resolveArrivalStayCity(leg.intercityToCity, stays, [], date)
    : metroDisplayLabel(leg.intercityToCity.trim());
  if (!from || !to) return null;
  return { from, to };
}

function applyAllocatedTransportPaint(
  state: TripSetupState,
  groupId: string,
  dayPlaces: DayPlaceDraft[],
  namedStays: AccommodationStayDraft[],
): DayPlaceDraft[] {
  const legs = scopedIntercityLegs(state, groupId);
  let result = [...dayPlaces];
  const paintedCityChange = new Set<string>();

  for (const leg of legs) {
    if (leg.surfaceOnly) continue;
    if (leg.legKind && leg.legKind !== "city_change") continue;

    const paintDate = cityChangePaintDate(leg, namedStays, result);
    if (!paintDate) continue;

    const corridor = resolveLegCorridorCities(leg, namedStays, paintDate);
    if (!corridor) continue;

    const day = result.find((d) => d.date === paintDate);
    if (day && dayConflictsWithLegCorridor(day, corridor.from, corridor.to)) continue;

    const routeKey = `${leg.intercityFromCity.trim().toLowerCase()}→${leg.intercityToCity.trim().toLowerCase()}`;
    if (paintedCityChange.has(routeKey)) continue;
    paintedCityChange.add(routeKey);

    result = inferDayPlacesFromIntercityLeg(
      result,
      { ...leg, travelDate: paintDate },
      { stays: namedStays },
    );
  }

  return result;
}

/**
 * Apply allocated transport paint. When checkConflicts is true (location edits),
 * unallocate conflicting legs and auto-allocate legs that match painted corridors.
 */
export function syncTransportLegAllocation(
  state: TripSetupState,
  groupId: string,
  options?: { checkConflicts?: boolean },
): TripSetupState {
  const namedStays = scopedNamedStays(state, groupId);
  const dayPlaces = [...(state.dayPlacesByGroupId[groupId] ?? [])];
  const scopedIds = new Set(scopedIntercityLegs(state, groupId).map((l) => l.id));

  let intercityLegs = state.intercityLegs;

  if (options?.checkConflicts) {
    intercityLegs = state.intercityLegs.map((leg) => {
      if (!scopedIds.has(leg.id)) return leg;
      if (leg.legKind && leg.legKind !== "city_change") return leg;

      const paintDate = cityChangePaintDate(leg, namedStays, dayPlaces);
      if (!paintDate) return leg;

      const corridor = resolveLegCorridorCities(leg, namedStays, paintDate);
      if (!corridor) return leg;

      const day = dayPlaces.find((d) => d.date === paintDate);
      if (!day || !dayHasPaint(day)) return leg;

      if (dayConflictsWithLegCorridor(day, corridor.from, corridor.to)) {
        return { ...leg, surfaceOnly: true };
      }
      if (dayMatchesLegCorridor(day, corridor.from, corridor.to)) {
        return { ...leg, surfaceOnly: false };
      }
      return leg;
    });
  }

  const withLegs = { ...state, intercityLegs };
  const repainted = applyAllocatedTransportPaint(withLegs, groupId, dayPlaces, namedStays);

  return enforceGroupHalfDayBoundaries(
    {
      ...withLegs,
      intercityLegs,
      dayPlacesByGroupId: {
        ...state.dayPlacesByGroupId,
        [groupId]: repainted,
      },
    },
    groupId,
  );
}

/** Unallocate legs overlapping a stay replacement range when cities no longer match. */
export function unallocateLegsForStayRange(
  state: TripSetupState,
  groupId: string,
  stay: Pick<AccommodationStayDraft, "cityLabel" | "checkInDate" | "checkOutDate">,
): TripSetupState {
  const city = stay.cityLabel.trim();
  if (!city) return state;

  const namedStays = scopedNamedStays(state, groupId);
  const dayPlaces = state.dayPlacesByGroupId[groupId] ?? [];
  const scopedIds = new Set(scopedIntercityLegs(state, groupId).map((l) => l.id));

  const intercityLegs = state.intercityLegs.map((leg) => {
    if (!scopedIds.has(leg.id) || leg.surfaceOnly) return leg;
    if (leg.legKind && leg.legKind !== "city_change") return leg;

    const paintDate = cityChangePaintDate(leg, namedStays, dayPlaces);
    if (!paintDate) return leg;
    if (paintDate < stay.checkInDate || paintDate > stay.checkOutDate) return leg;

    const from = leg.intercityFromCity.trim();
    const to = leg.intercityToCity.trim();
    if (!locationsMatch(from, city) || !locationsMatch(to, city)) {
      return { ...leg, surfaceOnly: true };
    }
    return leg;
  });

  return { ...state, intercityLegs };
}
