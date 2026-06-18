import { applySetupTransportChange } from "@/lib/host/setup/apply-setup-transport";
import { stayDatesForSelection } from "@/lib/host/setup/day-selection-setup";
import type { NightPairSelection } from "@/lib/host/setup/night-pair-selection";
import { removeAccommodationAndCitiesFromRange } from "@/lib/host/setup/remove-accommodation-range";
import { syncTripBoundsFromContent } from "@/lib/host/setup/sync-trip-bounds";
import type { TripSetupState } from "@/lib/host/setup/types";
import {
  clearCheckoutLocationDay,
  clearFullLocationDaysAfter,
} from "@/lib/trip-engine/paint-day-range";
import { enumerateDates } from "@/lib/host/wizard/location-stays";
import { legTouchesDate } from "@/lib/host/wizard/transport-leg-dates";
import type { ActivityDraft } from "@/lib/host/wizard/types";

function activityTouchesDate(activity: ActivityDraft, date: string): boolean {
  const end = activity.endDate?.trim() || activity.date;
  return activity.date <= date && date <= end;
}

/** Remove locations, stays, transport legs, and activities for a calendar selection. */
export function clearCalendarContentInRange(
  state: TripSetupState,
  selection: NightPairSelection,
  groupId: string,
): TripSetupState {
  const end = selection.rangeEnd || selection.rangeStart;
  const startHalf = selection.startHalf ?? "full";
  const endHalf = selection.endHalf ?? "full";

  let next = removeAccommodationAndCitiesFromRange(state, selection.rangeStart, end, groupId, {
    startHalf,
    endHalf,
  });

  const { checkOut } = stayDatesForSelection({
    rangeStart: selection.rangeStart,
    rangeEnd: end,
    startHalf,
    endHalf,
  });
  const clearedDays = clearCheckoutLocationDay(
    clearFullLocationDaysAfter(next.dayPlacesByGroupId[groupId] ?? [], checkOut),
    checkOut,
  );
  next = {
    ...next,
    dayPlacesByGroupId: {
      ...next.dayPlacesByGroupId,
      [groupId]: clearedDays,
    },
  };

  for (const date of enumerateDates(selection.rangeStart, end)) {
    next = {
      ...next,
      outboundLegs: next.outboundLegs.filter((leg) => !legTouchesDate(leg, date)),
      returnLegs: next.returnLegs.filter((leg) => !legTouchesDate(leg, date)),
      intercityLegs: next.intercityLegs.filter((leg) => !legTouchesDate(leg, date)),
      activities: next.activities.filter((activity) => !activityTouchesDate(activity, date)),
    };
  }

  if (groupId === state.mainGroupId) {
    return applySetupTransportChange(next, {
      outboundLegs: next.outboundLegs,
      returnLegs: next.returnLegs,
      intercityLegs: next.intercityLegs,
    });
  }

  return syncTripBoundsFromContent(next);
}

/** Remove locations, stays, transport legs, and activities for one calendar date. */
export function clearEverythingFromDay(
  state: TripSetupState,
  date: string,
  groupId: string,
): TripSetupState {
  return clearCalendarContentInRange(
    state,
    {
      rangeStart: date,
      rangeEnd: date,
      startHalf: "full",
      endHalf: "full",
    },
    groupId,
  );
}
