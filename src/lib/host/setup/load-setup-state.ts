import { asc, eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import {
  groupDayPlaces,
  groupOverlayOps,
  groups,
  trips,
} from "@/lib/db/schema";
import { ensureMainGroupForTrip } from "@/lib/groups/main-group";
import { loadTripLocationState } from "@/lib/host/locations/trip-location-state";
import { repairTransportLegsFromLookup } from "@/lib/host/setup/repair-transport-legs";
import { syncTripBoundsFromContent } from "@/lib/host/setup/sync-trip-bounds";
import { repairTransportGraphSync } from "@/lib/trip-engine/repair-transport-graph";
import { repairMisplacedSecondaryHalfDays } from "@/lib/trip-engine/sanitize-day-place";
import { graphToSetupState, setupStateToGraph } from "@/lib/trip-engine/adapters";
import type { DayPlaceDraft } from "@/lib/host/wizard/types";

import type { GroupOverlayOpDraft, SetupGroup, TripSetupState } from "./types";

function rowToDayPlace(row: {
  date: string;
  primaryCity: string;
  secondaryCity: string | null;
  primaryShare: string | number;
  dayType: string | null;
}): DayPlaceDraft {
  return {
    date: row.date,
    primaryCity: row.primaryCity,
    secondaryCity: row.secondaryCity,
    primaryShare: Number(row.primaryShare),
    dayType: (row.dayType ?? "trip") as DayPlaceDraft["dayType"],
    includeBuffer: false,
  };
}

export async function loadTripSetupState(tripId: string): Promise<TripSetupState | null> {
  const mainGroupId = await ensureMainGroupForTrip(tripId);

  const trip = await db
    .select({
      name: trips.name,
      schoolName: trips.schoolName,
      startDate: trips.startDate,
      endDate: trips.endDate,
      timezone: trips.timezone,
      departureCity: trips.departureCity,
      returnCity: trips.returnCity,
      defaultDepartureAirport: trips.defaultDepartureAirport,
      destinationCountry: trips.destinationCountry,
    })
    .from(trips)
    .where(eq(trips.id, tripId))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (!trip) return null;

  const locationState = await loadTripLocationState(tripId);
  if (!locationState) return null;

  const groupRows = await db
    .select({
      id: groups.id,
      name: groups.name,
      type: groups.type,
      description: groups.description,
      sortOrder: groups.sortOrder,
      isMain: groups.isMain,
      inheritMode: groups.inheritMode,
      personalForParticipantId: groups.personalForParticipantId,
    })
    .from(groups)
    .where(eq(groups.tripId, tripId))
    .orderBy(asc(groups.sortOrder));

  const placeRows = await db
    .select()
    .from(groupDayPlaces)
    .where(eq(groupDayPlaces.tripId, tripId))
    .orderBy(asc(groupDayPlaces.date));

  const opRows = await db
    .select()
    .from(groupOverlayOps)
    .where(eq(groupOverlayOps.tripId, tripId));

  const dayPlacesByGroupId: Record<string, DayPlaceDraft[]> = {};
  for (const g of groupRows) {
    dayPlacesByGroupId[g.id] = placeRows
      .filter((p) => p.groupId === g.id)
      .map(rowToDayPlace);
  }

  const setupGroups: SetupGroup[] = groupRows.map((g) => ({
    id: g.id,
    name: g.name,
    type: g.type,
    description: g.description,
    sortOrder: g.sortOrder,
    isMain: g.isMain,
    inheritMode:
      g.inheritMode === "overlay" || g.inheritMode === "independent"
        ? g.inheritMode
        : null,
    personalForParticipantId: g.personalForParticipantId,
  }));

  const overlayOps: GroupOverlayOpDraft[] = opRows.map((o) => ({
    id: o.id,
    groupId: o.groupId,
    entityType: o.entityType,
    baseEntityId: o.baseEntityId,
    op: o.op,
    replacementEntityId: o.replacementEntityId,
    effectiveFrom: o.effectiveFrom,
    effectiveTo: o.effectiveTo,
  }));

  const loaded: TripSetupState = {
    basics: {
      name: trip.name,
      schoolName: trip.schoolName,
      startDate: trip.startDate,
      endDate: trip.endDate,
      timezone: trip.timezone,
      departureCity: trip.departureCity ?? "",
      returnCity: trip.returnCity ?? "",
      defaultDepartureAirport: trip.defaultDepartureAirport ?? "",
      destinationCountries: trip.destinationCountry
        ? trip.destinationCountry.split(",").map((s) => s.trim())
        : [],
    },
    mainGroupId,
    groups: setupGroups,
    dayPlacesByGroupId,
    outboundLegs: locationState.outboundLegs,
    returnLegs: locationState.returnLegs,
    intercityLegs: locationState.intercityLegs,
    accommodationStays: locationState.accommodationStays,
    transportProducts: locationState.transportProducts ?? [],
    activities: [],
    overlayOps,
  };

  const hasTransport =
    loaded.outboundLegs.length > 0 ||
    loaded.returnLegs.length > 0 ||
    loaded.intercityLegs.length > 0;

  let state = loaded;
  if (hasTransport) {
    const repairedLegs = await repairTransportLegsFromLookup(loaded);
    state = { ...loaded, ...repairedLegs };
  }

  const mainDays = state.dayPlacesByGroupId[state.mainGroupId] ?? [];
  const repairedMainDays = repairMisplacedSecondaryHalfDays(
    mainDays,
    state.accommodationStays,
  );

  const repairedState = graphToSetupState(
    repairTransportGraphSync(
      setupStateToGraph(
        tripId,
        syncTripBoundsFromContent({
          ...state,
          dayPlacesByGroupId: {
            ...state.dayPlacesByGroupId,
            [state.mainGroupId]: repairedMainDays,
          },
        }),
      ),
    ),
  );

  return repairedState;
}
