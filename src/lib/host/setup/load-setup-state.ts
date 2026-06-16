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
import { applySetupAccommodationChange } from "@/lib/host/setup/apply-setup-accommodation";
import { applySetupTransportChange } from "@/lib/host/setup/apply-setup-transport";
import { repairTransportLegsFromLookup } from "@/lib/host/setup/repair-transport-legs";
import { syncTripBoundsFromContent } from "@/lib/host/setup/sync-trip-bounds";
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
    const places = placeRows
      .filter((p) => p.groupId === g.id)
      .map(rowToDayPlace);
    dayPlacesByGroupId[g.id] =
      places.length > 0
        ? places
        : g.isMain
          ? locationState.dayPlaces
          : [];
  }

  const setupGroups: SetupGroup[] = groupRows.map((g) => ({
    id: g.id,
    name: g.name,
    type: g.type,
    description: g.description,
    sortOrder: g.sortOrder,
    isMain: g.isMain,
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
    activities: [],
    overlayOps,
  };

  const hasNamedStays = loaded.accommodationStays.some((s) => s.name?.trim());
  const hasTransport =
    loaded.outboundLegs.length > 0 ||
    loaded.returnLegs.length > 0 ||
    loaded.intercityLegs.length > 0;

  if (hasNamedStays || hasTransport) {
    let withTransport = loaded;
    if (hasTransport) {
      const repairedLegs = await repairTransportLegsFromLookup(loaded);
      withTransport = { ...loaded, ...repairedLegs };
    }
    const withStays = hasNamedStays
      ? applySetupAccommodationChange(withTransport, withTransport.mainGroupId)
      : withTransport;
    return applySetupTransportChange(withStays, {
      outboundLegs: withStays.outboundLegs,
      returnLegs: withStays.returnLegs,
      intercityLegs: withStays.intercityLegs,
    });
  }

  return syncTripBoundsFromContent(loaded);
}
