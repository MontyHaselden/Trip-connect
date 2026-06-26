import { calendarGridFromToday } from "@/lib/host/setup/calendar-bounds";
import { tripDatesAreUnset } from "@/lib/host/trip-date-display";

/** Calendar grid bounds used when loading / slimming trip payloads. */
export function gridBoundsForTripLoad(input: {
  startDate: string;
  endDate: string;
  timezone: string;
}): { gridStart: string; gridEnd: string } {
  const grid = calendarGridFromToday({
    startDate: input.startDate,
    endDate: input.endDate,
    timezone: input.timezone,
  });
  return { gridStart: grid.gridStart, gridEnd: grid.gridEnd };
}

export function tripHasSetDates(startDate: string, endDate: string): boolean {
  return !tripDatesAreUnset(startDate, endDate);
}
