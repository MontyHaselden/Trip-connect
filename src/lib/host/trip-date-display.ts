export const TRIP_DATES_UNSET = "2000-01-01";

export function tripDatesAreUnset(startDate: string, endDate: string): boolean {
  return startDate === TRIP_DATES_UNSET && endDate === TRIP_DATES_UNSET;
}

export function formatTripDateRangeLabel(startDate: string, endDate: string): string {
  if (tripDatesAreUnset(startDate, endDate)) return "";
  if (startDate === endDate) return startDate;
  return `${startDate} → ${endDate}`;
}

/** Subtitle line for trip list cards — omits unset dates. */
export function formatTripListDateLabel(startDate: string, endDate: string): string | null {
  if (tripDatesAreUnset(startDate, endDate)) return null;
  return formatTripDateRangeLabel(startDate, endDate);
}
