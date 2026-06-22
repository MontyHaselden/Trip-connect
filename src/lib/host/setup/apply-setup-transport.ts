import { calendarGridBounds, calendarScrollBounds } from "@/lib/host/setup/calendar-bounds";
import { deriveHomeArrivalDay } from "@/lib/host/setup/derive-trip-bounds";
import { deriveCalendarState, overlayStoredHostLocations } from "@/lib/host/setup/derive-calendar";
import {
  clearOrphanOutboundHomePaint,
  enforceHomeLocks,
  ensurePostTripHomeBuffer,
  ensurePreTripHomeBuffer,
  postTripHomeBufferDate,
  preTripHomeBufferDate,
} from "@/lib/host/setup/home-locks";
import { syncTripBoundsFromContent } from "@/lib/host/setup/sync-trip-bounds";
import { enforceGroupHalfDayBoundaries } from "@/lib/host/setup/enforce-content-half-days";
import {
  allPlaneLegsFromState,
  inferDayPlacesFromFlightLegs,
  stripOrphanFlightPaint,
} from "@/lib/host/setup/infer-flight-calendar";
import {
  mainAccommodationStays,
  mainIntercityLegs,
} from "@/lib/host/setup/entity-scope";
import { repairTransportLegsSync } from "@/lib/host/setup/repair-transport-legs";
import { syncStaysToDestinationArrivals } from "@/lib/host/setup/sync-stays-to-arrivals";
import { TRIP_DATES_UNSET } from "@/lib/host/trip-date-display";
import { applyTransportToDraft } from "@/lib/host/wizard/derive-trip-dates";
import { tripDayInBounds } from "@/lib/host/setup/sync-trip-bounds";
import {
  arrivalDate,
  flightArrivalDates,
  flightDepartureDates,
  hasScheduledOutboundTransport,
  hasScheduledReturnTransport,
  returnDepartsAfterTripEnd,
} from "@/lib/host/wizard/transport-day-placement";
import type { TransportLegDraft, TripWizardDraft } from "@/lib/host/wizard/types";

import type { TripSetupState } from "./types";

function isUnsetDate(value: string | null | undefined): boolean {
  const trimmed = value?.trim() ?? "";
  return !trimmed || trimmed === TRIP_DATES_UNSET;
}

/** Sync trip dates, leg chains, and home-city calendar locks after transport edits. */
export function applySetupTransportChange(
  state: TripSetupState,
  updates: Partial<
    Pick<TripSetupState, "outboundLegs" | "returnLegs" | "intercityLegs">
  >,
): TripSetupState {
  const merged: TripSetupState = { ...state, ...updates };
  const repairedLegs = repairTransportLegsSync(merged);
  const next: TripSetupState = { ...merged, ...repairedLegs };
  const mainDays = next.dayPlacesByGroupId[next.mainGroupId] ?? [];

  const draft: TripWizardDraft = {
    version: 1,
    basics: { ...next.basics, destinationLanguages: [] },
    dayPlaces: mainDays,
    outboundLegs: next.outboundLegs,
    returnLegs: next.returnLegs,
    intercityLegs: next.intercityLegs,
    accommodationStays: next.accommodationStays,
    activities: next.activities,
    reminders: [],
    meetings: [],
    shellCommitted: true,
    datesPlacesConfirmed: false,
    wizardFinished: false,
  };

  const synced = applyTransportToDraft(draft);
  const namedStays = next.accommodationStays.filter((s) => s.name?.trim());
  const syncedStays = syncStaysToDestinationArrivals(next.accommodationStays, {
    outboundLegs: synced.outboundLegs,
    returnLegs: synced.returnLegs,
    intercityLegs: synced.intercityLegs,
  });

  const boundsSynced = syncTripBoundsFromContent({
    ...next,
    basics: synced.basics,
    accommodationStays: syncedStays,
    outboundLegs: synced.outboundLegs,
    returnLegs: synced.returnLegs,
    intercityLegs: synced.intercityLegs,
  });

  const trip = {
    startDate: boundsSynced.basics.startDate,
    endDate: boundsSynced.basics.endDate,
    departureCity: synced.basics.departureCity,
    returnCity: synced.basics.returnCity,
  };
  const transportDraft = {
    outboundLegs: synced.outboundLegs,
    returnLegs: synced.returnLegs,
    intercityLegs: synced.intercityLegs,
    dayPlaces: synced.dayPlaces,
  };

  const rebuildFromStays =
    namedStays.length > 0 &&
    (updates.outboundLegs !== undefined ||
      updates.returnLegs !== undefined ||
      (updates.intercityLegs !== undefined &&
        synced.intercityLegs.some((leg) => leg.transportType === "plane")));

  let lockedDays;

  if (rebuildFromStays) {
    const storedDays = boundsSynced.dayPlacesByGroupId[next.mainGroupId] ?? [];
    const scroll = calendarScrollBounds(
      boundsSynced.basics.startDate,
      boundsSynced.basics.endDate,
      synced.basics.timezone,
    );
    const grid = calendarGridBounds(scroll.scrollStart, scroll.scrollEnd);
    const derived = deriveCalendarState({
      stays: mainAccommodationStays({ ...next, accommodationStays: syncedStays }),
      intercityLegs: mainIntercityLegs({ ...next, intercityLegs: synced.intercityLegs }),
      trip,
      transportDraft: { ...transportDraft, dayPlaces: storedDays },
      gridStart: grid.gridStart,
      gridEnd: grid.gridEnd,
      overlayStoredLocationGaps: true,
    });
    lockedDays = derived.dayPlaces;
  } else {
    const planeLegs = allPlaneLegsFromState(synced);
    const strippedDays =
      planeLegs.length > 0
        ? stripOrphanFlightPaint(
            synced.dayPlaces,
            planeLegs,
            syncedStays.filter((s) => s.name?.trim()),
          )
        : synced.dayPlaces;
    lockedDays = inferDayPlacesFromFlightLegs(strippedDays, planeLegs, {
      stays: syncedStays.filter((s) => s.name?.trim()),
    });
    lockedDays = overlayStoredHostLocations(
      lockedDays,
      boundsSynced.dayPlacesByGroupId[next.mainGroupId] ?? [],
      namedStays,
    );
  }

  const hasReturnTransport = hasScheduledReturnTransport(transportDraft, trip);
  lockedDays = enforceHomeLocks(
    lockedDays,
    trip,
    flightDepartureDates(transportDraft, trip),
    flightArrivalDates(transportDraft, trip),
    returnDepartsAfterTripEnd(transportDraft, trip.endDate) || !hasReturnTransport,
  );
  const hasOutboundTransport = hasScheduledOutboundTransport(transportDraft);
  lockedDays = clearOrphanOutboundHomePaint(lockedDays, trip, hasOutboundTransport);
  lockedDays = ensurePreTripHomeBuffer(lockedDays, trip, hasOutboundTransport);

  const homeArrival = deriveHomeArrivalDay(
    {
      outboundLegs: synced.outboundLegs,
      returnLegs: synced.returnLegs,
      intercityLegs: synced.intercityLegs,
      returnCity: synced.basics.returnCity,
    },
    boundsSynced.basics.endDate,
  );
  lockedDays = ensurePostTripHomeBuffer(lockedDays, trip, hasReturnTransport, homeArrival);

  const calendarStart = hasOutboundTransport
    ? preTripHomeBufferDate(boundsSynced.basics.startDate)
    : boundsSynced.basics.startDate;
  const calendarEnd = hasReturnTransport
    ? postTripHomeBufferDate(boundsSynced.basics.endDate, homeArrival)
    : boundsSynced.basics.endDate;

  return enforceGroupHalfDayBoundaries(
    {
      ...boundsSynced,
      dayPlacesByGroupId: {
        ...boundsSynced.dayPlacesByGroupId,
        [next.mainGroupId]: lockedDays.filter((day) =>
          tripDayInBounds(day.date, calendarStart, calendarEnd),
        ),
      },
    },
    next.mainGroupId,
  );
}
