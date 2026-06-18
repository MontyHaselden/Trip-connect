import { calendarGridFromToday } from "@/lib/host/setup/calendar-bounds";
import { deriveCalendarState } from "@/lib/host/setup/derive-calendar";
import { deriveTripBoundsFromContent } from "@/lib/host/setup/derive-trip-bounds";
import { mainAccommodationStays, mainIntercityLegs } from "@/lib/host/setup/entity-scope";
import { syncTripBoundsFromContent } from "@/lib/host/setup/sync-trip-bounds";
import type { TripSetupState } from "@/lib/host/setup/types";
import { tripDatesAreUnset } from "@/lib/host/trip-date-display";
import type { DayPlaceDraft } from "@/lib/host/wizard/types";

function isMeaningfulPaint(day: DayPlaceDraft): boolean {
  const primary = day.primaryCity.trim();
  const secondary = day.secondaryCity?.trim() ?? "";
  if (day.dayType === "buffer") return false;
  if (!primary && !secondary) return false;
  if (primary.toLowerCase() === "tbc" && !secondary) return false;
  if (secondary.toLowerCase() === "tbc" && !primary) return false;
  return true;
}

function transportDatesFromState(state: TripSetupState): string[] {
  const dates: string[] = [];
  for (const leg of [...state.outboundLegs, ...state.returnLegs, ...state.intercityLegs]) {
    if (leg.travelDate?.trim()) dates.push(leg.travelDate);
  }
  return dates;
}

/** Day places the calendar actually renders — matches deriveCalendarState, not raw DB rows. */
export function getVisibleCalendarDayPlaces(state: TripSetupState): DayPlaceDraft[] {
  const content = deriveTripBoundsFromContent({
    accommodationStays: mainAccommodationStays(state).filter((s) => s.name?.trim()),
    outboundLegs: state.outboundLegs,
    returnLegs: state.returnLegs,
    intercityLegs: state.intercityLegs,
    activities: state.activities,
    dayPlaces: (state.dayPlacesByGroupId[state.mainGroupId] ?? []).filter(
      (day) => day.primaryCity.trim() || day.secondaryCity?.trim(),
    ),
    returnCity: state.basics.returnCity,
  });

  const startDate = content?.startDate ?? state.basics.startDate;
  const endDate = content?.endDate ?? state.basics.endDate;
  const stored = state.dayPlacesByGroupId[state.mainGroupId] ?? [];

  if (tripDatesAreUnset(startDate, endDate)) {
    return stored.filter(isMeaningfulPaint);
  }

  const grid = calendarGridFromToday({
    startDate,
    endDate,
    timezone: state.basics.timezone,
    dayPlaces: stored,
    accommodationStays: state.accommodationStays,
    transportDates: transportDatesFromState(state),
  });

  const derived = deriveCalendarState({
    stays: state.accommodationStays,
    intercityLegs: mainIntercityLegs(state),
    trip: {
      startDate,
      endDate,
      departureCity: state.basics.departureCity,
      returnCity: state.basics.returnCity,
    },
    transportDraft: {
      outboundLegs: state.outboundLegs,
      returnLegs: state.returnLegs,
      intercityLegs: state.intercityLegs,
      dayPlaces: stored,
    },
    gridStart: grid.gridStart,
    gridEnd: grid.gridEnd,
  });

  return derived.dayPlaces.filter(isMeaningfulPaint);
}

/** Drop stale stored paint / trip dates when the calendar is empty but the DB still has leftovers. */
export function reconcileTripShellState(state: TripSetupState): TripSetupState {
  const stored = state.dayPlacesByGroupId[state.mainGroupId] ?? [];
  const storedMeaningful = stored.filter(isMeaningfulPaint);
  const visible = getVisibleCalendarDayPlaces(state);
  const hasStays = mainAccommodationStays(state).some((s) => s.name?.trim());
  const hasTransport =
    state.outboundLegs.length > 0 ||
    state.returnLegs.length > 0 ||
    state.intercityLegs.length > 0;
  const hasActivities = state.activities.length > 0;

  if (
    storedMeaningful.length > 0 &&
    visible.length === 0 &&
    !hasStays &&
    !hasTransport &&
    !hasActivities
  ) {
    return syncTripBoundsFromContent({
      ...state,
      dayPlacesByGroupId: { ...state.dayPlacesByGroupId, [state.mainGroupId]: [] },
    });
  }

  return state;
}

export function tripHasPlannedContent(state: TripSetupState): boolean {
  const hasPaint = getVisibleCalendarDayPlaces(state).length > 0;
  const hasStays = mainAccommodationStays(state).some((s) => s.name?.trim());
  const hasTransport =
    state.outboundLegs.length > 0 ||
    state.returnLegs.length > 0 ||
    state.intercityLegs.length > 0;
  return hasPaint || hasStays || hasTransport || state.activities.length > 0;
}
