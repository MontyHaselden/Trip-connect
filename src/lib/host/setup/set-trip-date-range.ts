import type { TripSetupState } from "@/lib/host/setup/types";
import { syncTripBoundsFromContent } from "@/lib/host/setup/sync-trip-bounds";
import { addDays } from "@/lib/host/wizard/location-stays";
import { DateTime } from "luxon";
import type {
  AccommodationStayDraft,
  ActivityDraft,
  IntercityLegDraft,
  TransportLegDraft,
} from "@/lib/host/wizard/types";

export type TripDateRange = {
  startDate: string;
  endDate: string;
};

function inRange(date: string, range: TripDateRange): boolean {
  return date >= range.startDate && date <= range.endDate;
}

function activityInRange(activity: ActivityDraft, range: TripDateRange): boolean {
  const end = activity.endDate?.trim() || activity.date;
  return end >= range.startDate && activity.date <= range.endDate;
}

function stayInRange(stay: AccommodationStayDraft, range: TripDateRange): boolean {
  return stay.checkOutDate > range.startDate && stay.checkInDate <= range.endDate;
}

function trimStayToRange(
  stay: AccommodationStayDraft,
  range: TripDateRange,
): AccommodationStayDraft {
  return {
    ...stay,
    checkInDate: stay.checkInDate < range.startDate ? range.startDate : stay.checkInDate,
    checkOutDate: stay.checkOutDate > range.endDate ? range.endDate : stay.checkOutDate,
  };
}

function filterTransportLegs<T extends TransportLegDraft | IntercityLegDraft>(
  legs: T[],
  range: TripDateRange,
): T[] {
  return legs.filter((leg) => inRange(leg.travelDate, range));
}

/**
 * Calendar-first trim: keep only content inside the new trip window.
 * Day paint is authoritative — stays, transport, and activities follow.
 */
export function applyTripDateRange(
  state: TripSetupState,
  range: TripDateRange,
): TripSetupState {
  if (range.endDate < range.startDate) return state;

  const nextPlacesByGroupId: TripSetupState["dayPlacesByGroupId"] = {};
  for (const [groupId, days] of Object.entries(state.dayPlacesByGroupId)) {
    nextPlacesByGroupId[groupId] = days.filter((day) => inRange(day.date, range));
  }

  const next: TripSetupState = {
    ...state,
    basics: {
      ...state.basics,
      startDate: range.startDate,
      endDate: range.endDate,
    },
    dayPlacesByGroupId: nextPlacesByGroupId,
    activities: state.activities.filter((activity) => activityInRange(activity, range)),
    accommodationStays: state.accommodationStays
      .filter((stay) => stayInRange(stay, range))
      .map((stay) => trimStayToRange(stay, range)),
    outboundLegs: filterTransportLegs(state.outboundLegs, range),
    returnLegs: filterTransportLegs(state.returnLegs, range),
    intercityLegs: filterTransportLegs(state.intercityLegs, range),
  };

  return next;
}

/** Shift every dated trip row by a fixed number of days (negative = earlier). */
export function shiftTripDates(state: TripSetupState, deltaDays: number): TripSetupState {
  if (deltaDays === 0) return state;

  const shift = (iso: string) => addDays(iso, deltaDays);

  const nextPlacesByGroupId: TripSetupState["dayPlacesByGroupId"] = {};
  for (const [groupId, days] of Object.entries(state.dayPlacesByGroupId)) {
    nextPlacesByGroupId[groupId] = days.map((day) => ({ ...day, date: shift(day.date) }));
  }

  const next: TripSetupState = {
    ...state,
    dayPlacesByGroupId: nextPlacesByGroupId,
    activities: state.activities.map((activity) => ({
      ...activity,
      date: shift(activity.date),
      endDate: activity.endDate?.trim() ? shift(activity.endDate) : activity.endDate,
    })),
    accommodationStays: state.accommodationStays.map((stay) => ({
      ...stay,
      checkInDate: shift(stay.checkInDate),
      checkOutDate: shift(stay.checkOutDate),
    })),
    outboundLegs: state.outboundLegs.map((leg) => ({
      ...leg,
      travelDate: shift(leg.travelDate),
    })),
    returnLegs: state.returnLegs.map((leg) => ({
      ...leg,
      travelDate: shift(leg.travelDate),
    })),
    intercityLegs: state.intercityLegs.map((leg) => ({
      ...leg,
      travelDate: shift(leg.travelDate),
    })),
  };

  return syncTripBoundsFromContent(next);
}

function shiftIsoByMonths(iso: string, deltaMonths: number): string {
  return DateTime.fromISO(iso, { zone: "utc" }).plus({ months: deltaMonths }).toISODate()!;
}

/** Shift every dated trip row by whole months (negative = earlier). */
export function shiftTripByMonths(state: TripSetupState, deltaMonths: number): TripSetupState {
  if (deltaMonths === 0) return state;

  const shift = (iso: string) => shiftIsoByMonths(iso, deltaMonths);

  const nextPlacesByGroupId: TripSetupState["dayPlacesByGroupId"] = {};
  for (const [groupId, days] of Object.entries(state.dayPlacesByGroupId)) {
    nextPlacesByGroupId[groupId] = days.map((day) => ({ ...day, date: shift(day.date) }));
  }

  const next: TripSetupState = {
    ...state,
    dayPlacesByGroupId: nextPlacesByGroupId,
    activities: state.activities.map((activity) => ({
      ...activity,
      date: shift(activity.date),
      endDate: activity.endDate?.trim() ? shift(activity.endDate) : activity.endDate,
    })),
    accommodationStays: state.accommodationStays.map((stay) => ({
      ...stay,
      checkInDate: shift(stay.checkInDate),
      checkOutDate: shift(stay.checkOutDate),
    })),
    outboundLegs: state.outboundLegs.map((leg) => ({
      ...leg,
      travelDate: shift(leg.travelDate),
    })),
    returnLegs: state.returnLegs.map((leg) => ({
      ...leg,
      travelDate: shift(leg.travelDate),
    })),
    intercityLegs: state.intercityLegs.map((leg) => ({
      ...leg,
      travelDate: shift(leg.travelDate),
    })),
  };

  return syncTripBoundsFromContent(next);
}

export function summarizeTripDateRangeChange(
  before: TripDateRange,
  after: TripDateRange,
): {
  removedDaysBefore: number;
  removedDaysAfter: number;
} {
  const beforeStart = before.startDate;
  const beforeEnd = before.endDate;
  let removedDaysBefore = 0;
  let removedDaysAfter = 0;

  if (after.startDate > beforeStart) {
    removedDaysBefore = Math.max(
      0,
      Math.round(
        (Date.parse(after.startDate) - Date.parse(beforeStart)) / (1000 * 60 * 60 * 24),
      ),
    );
  }
  if (after.endDate < beforeEnd) {
    removedDaysAfter = Math.max(
      0,
      Math.round(
        (Date.parse(beforeEnd) - Date.parse(after.endDate)) / (1000 * 60 * 60 * 24),
      ),
    );
  }

  return { removedDaysBefore, removedDaysAfter };
}
