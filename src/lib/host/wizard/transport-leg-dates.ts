import { addDays } from "./location-stays";
import { arrivalDate } from "./transport-day-placement";
import type { TransportLegDraft } from "./types";

/** Whether a transport leg paints on this calendar date (departure, arrival, or in-flight). */
export function legTouchesDate(leg: TransportLegDraft, date: string): boolean {
  const dep = leg.travelDate?.trim();
  if (!dep || !date) return false;
  const arr = arrivalDate(leg);
  if (date === dep || date === arr) return true;
  if (date > dep && date < arr) return true;
  return false;
}

export function legTouchesRange(leg: TransportLegDraft, start: string, end: string): boolean {
  if (!start) return false;
  const last = end || start;
  let cursor = start;
  while (cursor <= last) {
    if (legTouchesDate(leg, cursor)) return true;
    cursor = addDays(cursor, 1);
  }
  return false;
}
