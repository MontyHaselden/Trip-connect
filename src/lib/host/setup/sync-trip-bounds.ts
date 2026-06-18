import { mainAccommodationStays } from "@/lib/host/setup/entity-scope";
import {
  deriveTripBoundsFromContent,
  type TripBoundsFromContent,
} from "@/lib/host/setup/derive-trip-bounds";
import type { TripSetupState } from "@/lib/host/setup/types";
import { TRIP_DATES_UNSET, tripDatesAreUnset } from "@/lib/host/trip-date-display";
import { locationsMatch } from "@/lib/host/wizard/location-stays";
import { hasScheduledReturnTransport } from "@/lib/host/wizard/transport-day-placement";
import type { DayPlaceDraft } from "@/lib/host/wizard/types";

function tripHasStoredContent(state: TripSetupState): boolean {
  const mainDays = state.dayPlacesByGroupId[state.mainGroupId] ?? [];
  const hasPaint = mainDays.some((d) => d.primaryCity.trim() && d.dayType !== "buffer");
  const hasStays = mainAccommodationStays(state).some((s) => s.name?.trim());
  const hasTransport =
    state.outboundLegs.length > 0 ||
    state.returnLegs.length > 0 ||
    state.intercityLegs.length > 0;
  return hasPaint || hasStays || hasTransport || state.activities.length > 0;
}

function returnCityOnlyDay(day: DayPlaceDraft, returnCity: string): boolean {
  const ret = returnCity.trim();
  if (!ret || day.secondaryCity?.trim()) return false;
  return Boolean(day.primaryCity.trim() && locationsMatch(day.primaryCity, ret));
}

function dayPlacesForBounds(state: TripSetupState, days: DayPlaceDraft[]): DayPlaceDraft[] {
  const hasReturn = hasScheduledReturnTransport(state, {
    endDate: state.basics.endDate,
    returnCity: state.basics.returnCity,
  });
  if (hasReturn) return days;
  return days.filter((day) => !returnCityOnlyDay(day, state.basics.returnCity));
}

export function tripBoundsInputFromState(
  state: TripSetupState,
  paintedDays?: DayPlaceDraft[],
): Parameters<typeof deriveTripBoundsFromContent>[0] {
  const rawDays =
    paintedDays ??
    (state.dayPlacesByGroupId[state.mainGroupId] ?? []).filter(
      (day) => day.primaryCity.trim() || day.secondaryCity?.trim(),
    );

  return {
    accommodationStays: mainAccommodationStays(state).filter((s) => s.name?.trim()),
    outboundLegs: state.outboundLegs,
    returnLegs: state.returnLegs,
    intercityLegs: state.intercityLegs,
    activities: state.activities,
    dayPlaces: dayPlacesForBounds(state, rawDays),
    returnCity: state.basics.returnCity,
  };
}

/** Trip span implied by current stays, transport, and activities — not stale DB dates. */
export function contentTripBoundsFromState(
  state: TripSetupState,
): TripBoundsFromContent | null {
  return deriveTripBoundsFromContent(tripBoundsInputFromState(state));
}

export function effectiveTripBoundsFromState(state: TripSetupState): {
  startDate: string;
  endDate: string;
  fromContent: boolean;
} {
  const content = contentTripBoundsFromState(state);
  if (content) {
    return { ...content, fromContent: true };
  }
  // Stored rows can lag after calendar clears — do not show ghost dates when DB has no content.
  if (!tripHasStoredContent(state)) {
    return {
      startDate: TRIP_DATES_UNSET,
      endDate: TRIP_DATES_UNSET,
      fromContent: false,
    };
  }
  if (!tripDatesAreUnset(state.basics.startDate, state.basics.endDate)) {
    return {
      startDate: state.basics.startDate,
      endDate: state.basics.endDate,
      fromContent: false,
    };
  }
  return {
    startDate: state.basics.startDate,
    endDate: state.basics.endDate,
    fromContent: false,
  };
}

export function tripDayInBounds(
  date: string,
  startDate: string,
  endDate: string,
): boolean {
  if (tripDatesAreUnset(startDate, endDate)) return true;
  return date >= startDate && date <= endDate;
}

/** Uncovered days inside the trip date range only — not the wider scroll calendar. */
export function uncoveredTripDays(
  days: DayPlaceDraft[],
  startDate: string,
  endDate: string,
): DayPlaceDraft[] {
  if (tripDatesAreUnset(startDate, endDate)) return [];
  return days.filter(
    (d) =>
      tripDayInBounds(d.date, startDate, endDate) &&
      !d.primaryCity.trim() &&
      d.dayType !== "buffer",
  );
}

/** Shrink or grow trip dates to match current stays, transport, and activities. */
export function syncTripBoundsFromContent(state: TripSetupState): TripSetupState {
  const bounds = contentTripBoundsFromState(state);

  if (!bounds) {
    if (tripDatesAreUnset(state.basics.startDate, state.basics.endDate)) return state;
    return {
      ...state,
      basics: {
        ...state.basics,
        startDate: TRIP_DATES_UNSET,
        endDate: TRIP_DATES_UNSET,
      },
    };
  }

  const { startDate, endDate } = bounds;
  if (
    state.basics.startDate === startDate &&
    state.basics.endDate === endDate
  ) {
    return state;
  }

  const nextPlacesByGroupId: TripSetupState["dayPlacesByGroupId"] = {};
  for (const [groupId, days] of Object.entries(state.dayPlacesByGroupId)) {
    nextPlacesByGroupId[groupId] = days.filter((day) =>
      tripDayInBounds(day.date, startDate, endDate),
    );
  }

  return {
    ...state,
    basics: { ...state.basics, startDate, endDate },
    dayPlacesByGroupId: nextPlacesByGroupId,
  };
}
