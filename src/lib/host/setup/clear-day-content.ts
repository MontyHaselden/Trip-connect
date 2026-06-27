import { applySetupTransportChange } from "@/lib/host/setup/apply-setup-transport";
import type { NightPairSelection } from "@/lib/host/setup/night-pair-selection";
import { removeAccommodationAndCitiesFromRange } from "@/lib/host/setup/remove-accommodation-range";
import { syncTripBoundsFromContent } from "@/lib/host/setup/sync-trip-bounds";
import type { TripSetupState } from "@/lib/host/setup/types";
import { enumerateDates } from "@/lib/host/wizard/location-stays";
import type { ActivityDraft } from "@/lib/host/wizard/types";

function activityTouchesDate(activity: ActivityDraft, date: string): boolean {
  const end = activity.endDate?.trim() || activity.date;
  return activity.date <= date && date <= end;
}

function legOwnedByGroup(
  leg: { originGroupId?: string | null },
  groupId: string,
  mainGroupId: string,
): boolean {
  if (!leg.originGroupId || leg.originGroupId === mainGroupId) {
    return groupId === mainGroupId;
  }
  return leg.originGroupId === groupId;
}

function activityOwnedByGroup(
  activity: ActivityDraft,
  groupId: string,
  mainGroupId: string,
): boolean {
  const origin = activity.originGroupId ?? null;
  if (!origin || origin === mainGroupId) return groupId === mainGroupId;
  return origin === groupId;
}

function removeLegsOnDatesForGroup<T extends { travelDate: string; originGroupId?: string | null }>(
  legs: T[],
  dates: Set<string>,
  groupId: string,
  mainGroupId: string,
): T[] {
  return legs.filter(
    (leg) =>
      !dates.has(leg.travelDate) || !legOwnedByGroup(leg, groupId, mainGroupId),
  );
}

function removeActivitiesOnDatesForGroup(
  activities: ActivityDraft[],
  dates: Set<string>,
  groupId: string,
  mainGroupId: string,
): ActivityDraft[] {
  return activities.filter((activity) => {
    for (const date of dates) {
      if (activityTouchesDate(activity, date) && activityOwnedByGroup(activity, groupId, mainGroupId)) {
        return false;
      }
    }
    return true;
  });
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

  const clearedDates = new Set(enumerateDates(selection.rangeStart, end));
  next = {
    ...next,
    outboundLegs: removeLegsOnDatesForGroup(
      next.outboundLegs,
      clearedDates,
      groupId,
      state.mainGroupId,
    ),
    returnLegs: removeLegsOnDatesForGroup(
      next.returnLegs,
      clearedDates,
      groupId,
      state.mainGroupId,
    ),
    intercityLegs: removeLegsOnDatesForGroup(
      next.intercityLegs,
      clearedDates,
      groupId,
      state.mainGroupId,
    ),
    activities: removeActivitiesOnDatesForGroup(
      next.activities,
      clearedDates,
      groupId,
      state.mainGroupId,
    ),
  };

  if (groupId === state.mainGroupId) {
    return applySetupTransportChange(
      next,
      {
        outboundLegs: next.outboundLegs,
        returnLegs: next.returnLegs,
        intercityLegs: next.intercityLegs,
      },
      { preserveCalendarPaint: true },
    );
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
