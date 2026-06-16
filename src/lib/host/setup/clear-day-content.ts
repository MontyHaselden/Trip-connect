import { applySetupTransportChange } from "@/lib/host/setup/apply-setup-transport";
import { removeAccommodationAndCitiesFromRange } from "@/lib/host/setup/remove-accommodation-range";
import { syncTripBoundsFromContent } from "@/lib/host/setup/sync-trip-bounds";
import type { TripSetupState } from "@/lib/host/setup/types";
import { legTouchesDate } from "@/lib/host/wizard/transport-leg-dates";
import type { ActivityDraft } from "@/lib/host/wizard/types";

function activityTouchesDate(activity: ActivityDraft, date: string): boolean {
  const end = activity.endDate?.trim() || activity.date;
  return activity.date <= date && date <= end;
}

/** Remove locations, stays, transport legs, and activities for one calendar date. */
export function clearEverythingFromDay(
  state: TripSetupState,
  date: string,
  groupId: string,
): TripSetupState {
  let next = removeAccommodationAndCitiesFromRange(state, date, date, groupId, {
    startHalf: "full",
    endHalf: "full",
  });

  next = {
    ...next,
    outboundLegs: next.outboundLegs.filter((leg) => !legTouchesDate(leg, date)),
    returnLegs: next.returnLegs.filter((leg) => !legTouchesDate(leg, date)),
    intercityLegs: next.intercityLegs.filter((leg) => !legTouchesDate(leg, date)),
    activities: next.activities.filter((activity) => !activityTouchesDate(activity, date)),
  };

  if (groupId === state.mainGroupId) {
    return applySetupTransportChange(next, {
      outboundLegs: next.outboundLegs,
      returnLegs: next.returnLegs,
      intercityLegs: next.intercityLegs,
    });
  }

  return syncTripBoundsFromContent(next);
}
