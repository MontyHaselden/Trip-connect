import { DateTime } from "luxon";

export function parseTimeValue(value: string | null | undefined): {
  hour24: number;
  minute: number;
} | null {
  if (!value?.trim()) return null;
  const dt = DateTime.fromFormat(value.trim(), "HH:mm");
  if (!dt.isValid) return null;
  return { hour24: dt.hour, minute: dt.minute };
}

export function toTimeValue(hour24: number, minute: number): string {
  return DateTime.fromObject({ hour: hour24, minute }).toFormat("HH:mm");
}

export function to12HourParts(hour24: number): { hour12: number; period: "AM" | "PM" } {
  const period: "AM" | "PM" = hour24 >= 12 ? "PM" : "AM";
  const raw = hour24 % 12;
  return { hour12: raw === 0 ? 12 : raw, period };
}

export function from12HourParts(hour12: number, minute: number, period: "AM" | "PM"): string {
  let hour24 = hour12 % 12;
  if (period === "PM") hour24 += 12;
  return toTimeValue(hour24, minute);
}

export function formatTimeDisplay(value: string | null | undefined): string {
  const parsed = parseTimeValue(value);
  if (!parsed) return "";
  return DateTime.fromObject({ hour: parsed.hour24, minute: parsed.minute }).toFormat("h:mm a");
}

export const HOUR12_OPTIONS = Array.from({ length: 12 }, (_, i) => i + 1);
export const MINUTE_OPTIONS = Array.from({ length: 60 }, (_, i) => i);
export const PERIOD_OPTIONS = ["AM", "PM"] as const;
