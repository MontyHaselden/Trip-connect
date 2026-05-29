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

export type TripPhase = "pre" | "active" | "post";

export function getTripPhase(params: {
  now?: DateTime;
  startDate: string;
  endDate: string;
  tripTimezone: string;
}): TripPhase {
  const now = params.now ?? DateTime.now().setZone(params.tripTimezone);
  const start = DateTime.fromISO(params.startDate, {
    zone: params.tripTimezone,
  }).startOf("day");
  const end = DateTime.fromISO(params.endDate, {
    zone: params.tripTimezone,
  }).endOf("day");
  if (now < start) return "pre";
  if (now > end) return "post";
  return "active";
}

export function isTripEve(params: {
  now?: DateTime;
  startDate: string;
  tripTimezone: string;
}): boolean {
  const now = params.now ?? DateTime.now().setZone(params.tripTimezone);
  const start = DateTime.fromISO(params.startDate, {
    zone: params.tripTimezone,
  }).startOf("day");
  const eve = start.minus({ days: 1 });
  return now.hasSame(eve, "day");
}

export function getCountdownToStart(params: {
  now?: DateTime;
  startDate: string;
  tripTimezone: string;
}): { days: number; hours: number; label: string } {
  const now = params.now ?? DateTime.now().setZone(params.tripTimezone);
  const start = DateTime.fromISO(params.startDate, {
    zone: params.tripTimezone,
  }).startOf("day");

  if (isTripEve(params)) {
    const diff = start.diff(now, ["hours"]);
    const hours = Math.max(0, Math.ceil(diff.hours));
    return { days: 0, hours, label: "Starts tomorrow!" };
  }

  const diff = start.diff(now, ["days", "hours"]);
  const days = Math.max(0, Math.floor(diff.days));
  const hours = Math.max(0, Math.floor(diff.hours % 24));

  if (days === 0 && hours === 0) {
    return { days: 0, hours: 0, label: "Starts today!" };
  }

  let label: string;
  if (days === 0) {
    label = `Starts in ${hours} hour${hours === 1 ? "" : "s"}`;
  } else if (hours > 0) {
    label = `Starts in ${days} day${days === 1 ? "" : "s"}, ${hours} hour${hours === 1 ? "" : "s"}`;
  } else {
    label = `Starts in ${days} day${days === 1 ? "" : "s"}`;
  }

  return { days, hours, label };
}
