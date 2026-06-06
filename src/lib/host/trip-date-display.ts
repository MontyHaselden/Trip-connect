export const TRIP_DATES_UNSET = "2000-01-01";

export function tripDatesAreUnset(startDate: string, endDate: string): boolean {
  return startDate === TRIP_DATES_UNSET && endDate === TRIP_DATES_UNSET;
}

export function formatTripDateRangeLabel(startDate: string, endDate: string): string {
  if (tripDatesAreUnset(startDate, endDate)) return "Dates set by AI";
  if (startDate === endDate) return startDate;
  return `${startDate} → ${endDate}`;
}
