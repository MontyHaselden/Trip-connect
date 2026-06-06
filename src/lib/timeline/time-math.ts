import { DateTime } from "luxon";

import { tripLocalDateTime, tripNow } from "@/lib/utils/time";

export const DAY_MINUTES = 24 * 60;
export const PX_PER_MINUTE = 2;
export const SNAP_MINUTES = 15;
export const MIN_DURATION_MINUTES = 15;
export const TIMELINE_HEIGHT_PX = DAY_MINUTES * PX_PER_MINUTE;
export const TIMELINE_GUTTER_PX = 44;

export function timeToMinutes(timeHHMMSS: string): number {
  const parts = timeHHMMSS.split(":");
  const h = Number(parts[0] ?? 0);
  const m = Number(parts[1] ?? 0);
  return h * 60 + m;
}

export function minutesToTimeHHMMSS(minutes: number): string {
  const snapped = snapMinutes(minutes);
  const clamped = Math.max(0, Math.min(DAY_MINUTES - MIN_DURATION_MINUTES, snapped));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;
}

export function snapMinutes(minutes: number): number {
  return Math.round(minutes / SNAP_MINUTES) * SNAP_MINUTES;
}

export function minutesToTopPx(minutes: number): number {
  return minutes * PX_PER_MINUTE;
}

export function durationToHeightPx(durationMinutes: number): number {
  return Math.max(
    MIN_DURATION_MINUTES * PX_PER_MINUTE,
    durationMinutes * PX_PER_MINUTE,
  );
}

export function pointerYToMinutes(yPx: number, scrollTop: number): number {
  return snapMinutes((yPx + scrollTop) / PX_PER_MINUTE);
}

export function getNowMinutes(tripTimezone: string, dateISO: string): number | null {
  const now = tripNow(tripTimezone);
  if (now.toISODate() !== dateISO) return null;
  return now.hour * 60 + now.minute + now.second / 60;
}

export function getDisplayEndMinutes(
  startMinutes: number,
  endTime: string | null,
  nextStartMinutes: number | null,
): number {
  if (endTime) {
    const end = timeToMinutes(endTime);
    return Math.max(end, startMinutes + MIN_DURATION_MINUTES);
  }
  const oneHourLater = startMinutes + 60;
  if (nextStartMinutes !== null && nextStartMinutes > startMinutes) {
    return Math.max(startMinutes + MIN_DURATION_MINUTES, Math.min(oneHourLater, nextStartMinutes));
  }
  return oneHourLater;
}

export function defaultCreateEndMinutes(
  startMinutes: number,
  sortedStarts: number[],
): number {
  const next = sortedStarts.find((s) => s > startMinutes);
  return getDisplayEndMinutes(startMinutes, null, next ?? null);
}

export function computeDisplayDurationMinutes(
  item: { startTime: string; endTime: string | null },
  nextStartMinutes: number | null,
): number {
  const start = timeToMinutes(item.startTime);
  const end = getDisplayEndMinutes(start, item.endTime, nextStartMinutes);
  return Math.max(MIN_DURATION_MINUTES, end - start);
}

/** Minutes per item for proportional day-sheet block heights. */
export function computeDisplayDurationsById(
  items: Array<{ id: string; startTime: string; endTime: string | null; sortOrder?: number }>,
): Map<string, number> {
  const sorted = [...items].sort((a, b) => {
    const cmp = a.startTime.localeCompare(b.startTime);
    if (cmp !== 0) return cmp;
    return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
  });
  const map = new Map<string, number>();
  for (let i = 0; i < sorted.length; i++) {
    const item = sorted[i];
    const next = sorted[i + 1];
    const nextStart = next ? timeToMinutes(next.startTime) : null;
    map.set(item.id, computeDisplayDurationMinutes(item, nextStart));
  }
  return map;
}

export function sortItemsByStartTime<T extends { startTime: string; sortOrder: number }>(
  items: T[],
): T[] {
  return [...items].sort((a, b) => {
    const cmp = a.startTime.localeCompare(b.startTime);
    if (cmp !== 0) return cmp;
    return a.sortOrder - b.sortOrder;
  });
}

export function computeSortOrderMap(
  items: Array<{ id: string; startTime: string; sortOrder: number }>,
): Map<string, number> {
  const sorted = sortItemsByStartTime(items);
  const map = new Map<string, number>();
  sorted.forEach((item, index) => map.set(item.id, index + 1));
  return map;
}

export function isActiveAtNow(
  nowMinutes: number,
  startMinutes: number,
  endMinutes: number,
): boolean {
  return nowMinutes >= startMinutes && nowMinutes < endMinutes;
}

export function clampDurationMove(
  startMinutes: number,
  durationMinutes: number,
): { startMinutes: number; endMinutes: number } {
  const dur = Math.max(MIN_DURATION_MINUTES, durationMinutes);
  let start = snapMinutes(startMinutes);
  let end = start + dur;
  if (end > DAY_MINUTES) {
    end = DAY_MINUTES;
    start = Math.max(0, end - dur);
  }
  start = snapMinutes(start);
  end = snapMinutes(end);
  if (end <= start) end = start + MIN_DURATION_MINUTES;
  return { startMinutes: start, endMinutes: end };
}

export function clampResizeStart(startMinutes: number, endMinutes: number): number {
  const start = snapMinutes(Math.max(0, Math.min(startMinutes, endMinutes - MIN_DURATION_MINUTES)));
  return start;
}

export function clampResizeEnd(startMinutes: number, endMinutes: number): number {
  const end = snapMinutes(
    Math.max(startMinutes + MIN_DURATION_MINUTES, Math.min(endMinutes, DAY_MINUTES)),
  );
  return end;
}

export function formatHourLabel(hour: number): string {
  if (hour === 0) return "12am";
  if (hour === 12) return "12pm";
  if (hour < 12) return `${hour}am`;
  return `${hour - 12}pm`;
}

export function itemIntersectsMinutes(
  itemStart: number,
  itemEnd: number,
  probeStart: number,
  probeEnd: number,
): boolean {
  return itemStart < probeEnd && itemEnd > probeStart;
}

export function tripDateTimeFromMinutes(
  dateISO: string,
  minutes: number,
  tripTimezone: string,
): DateTime {
  return tripLocalDateTime({
    dateISO,
    timeHHMMSS: minutesToTimeHHMMSS(minutes),
    tripTimezone,
  });
}
