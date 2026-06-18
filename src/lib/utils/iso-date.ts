import { DateTime } from "luxon";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidIsoDate(value: string): boolean {
  if (!ISO_DATE_RE.test(value)) return false;
  const dt = DateTime.fromISO(value, { zone: "utc" });
  return dt.isValid && dt.toISODate() === value;
}

/** Clamp impossible calendar days (e.g. Feb 29 in a common year) to the last valid day of that month. */
export function repairIsoDate(value: string): string {
  if (isValidIsoDate(value)) return value;
  if (!ISO_DATE_RE.test(value)) return value;

  const [year, month, day] = value.split("-").map((part) => Number(part));
  const lastDay = DateTime.utc(year, month, 1).endOf("month").day;
  const clampedDay = Math.min(day, lastDay);
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(clampedDay).padStart(2, "0")}`;
}

export function assertValidIsoDate(value: string, label = "date"): string {
  if (!isValidIsoDate(value)) {
    throw new Error(`Invalid ${label}: ${value} is not a real calendar day.`);
  }
  return value;
}
