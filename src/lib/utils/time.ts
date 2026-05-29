import { DateTime } from "luxon";

export function tripNow(tripTimezone: string): DateTime {
  return DateTime.now().setZone(tripTimezone);
}

export function tripDayStart(dateISO: string, tripTimezone: string): DateTime {
  return DateTime.fromISO(dateISO, { zone: tripTimezone }).startOf("day");
}

export function tripLocalDateTime(params: {
  dateISO: string; // YYYY-MM-DD
  timeHHMMSS: string; // HH:MM:SS
  tripTimezone: string;
}): DateTime {
  const { dateISO, timeHHMMSS, tripTimezone } = params;
  return DateTime.fromISO(`${dateISO}T${timeHHMMSS}`, { zone: tripTimezone });
}

export function formatTripDateHeader(params: {
  dateISO: string;
  tripTimezone: string;
}): string {
  const dt = DateTime.fromISO(params.dateISO, { zone: params.tripTimezone });
  return dt.toFormat("cccc d LLLL");
}

export function formatTripTime(timeHHMMSS: string, tripTimezone: string): string {
  // Parse as time in the trip timezone, formatting to a user-friendly time.
  const dt = DateTime.fromISO(`1970-01-01T${timeHHMMSS}`, { zone: tripTimezone });
  return dt.toFormat("h:mma").toLowerCase();
}

export function formatRelativeFromNow(target: DateTime): string {
  const now = DateTime.now();
  const diff = target.toMillis() - now.toMillis();
  const minutes = Math.round(diff / (60 * 1000));

  if (minutes <= 0) return "now";
  if (minutes < 60) return `in ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours < 24) return mins ? `in ${hours}h ${mins}m` : `in ${hours}h`;
  const days = Math.floor(hours / 24);
  return `in ${days}d`;
}
