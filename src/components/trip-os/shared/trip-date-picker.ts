import { tripCalendarScrollAnchor } from "@/lib/host/setup/calendar-bounds";
import { effectiveTripBoundsFromState } from "@/lib/host/setup/sync-trip-bounds";
import { tripDatesAreUnset } from "@/lib/host/trip-date-display";
import type { TripEntityGraph } from "@/lib/trip-engine/types";

export function tripDatePickerContext(
  graph: TripEntityGraph,
  preferredDate?: string | null,
): {
  tripStart?: string;
  tripEnd?: string;
  anchorDate?: string;
} {
  const { startDate, endDate } = effectiveTripBoundsFromState(graph);
  const hasBounds = !tripDatesAreUnset(startDate, endDate);
  const anchor =
    preferredDate?.trim() ||
    (hasBounds ? tripCalendarScrollAnchor(startDate, endDate) : "");

  return {
    tripStart: hasBounds ? startDate : undefined,
    tripEnd: hasBounds ? endDate : undefined,
    anchorDate: anchor || undefined,
  };
}
