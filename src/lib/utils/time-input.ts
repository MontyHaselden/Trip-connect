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

export const MINUTE_STEP = 5;

export function snapMinuteToStep(minute: number, step = MINUTE_STEP): number {
  const snapped = Math.round(minute / step) * step;
  return Math.min(60 - step, Math.max(0, snapped));
}

/** Every time slot in 5-minute steps (HH:mm, 00:00–23:55). */
export const TIME_OPTIONS: string[] = (() => {
  const out: string[] = [];
  for (let hour = 0; hour < 24; hour++) {
    for (let minute = 0; minute < 60; minute += MINUTE_STEP) {
      out.push(toTimeValue(hour, minute));
    }
  }
  return out;
})();

export const DEFAULT_TIME_OPTION = "09:00";

export function normalizeTimeValue(
  value: string | null | undefined,
  fallback = DEFAULT_TIME_OPTION,
): string {
  const parsed = parseTimeValue(value);
  if (!parsed) return fallback;
  return toTimeValue(parsed.hour24, snapMinuteToStep(parsed.minute));
}
