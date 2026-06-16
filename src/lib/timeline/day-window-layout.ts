import {
  buildProportionalDayRows,
  DEFAULT_LAST_EVENT_DURATION_MINUTES,
  eventDurationMinutes,
  type ProportionalDayEvent,
} from "./proportional-day-rows";
import { sortItemsByStartTime, timeToMinutes } from "./time-math";

export type DayWindowLayout = {
  heightsById: Map<string, number>;
  totalHeight: number;
  needsScroll: boolean;
  minBlockHeightPx: number;
  windowMinutes: number;
};

export function computeDayWindowMinutes(
  items: Array<{ startTime: string; endTime: string | null; sortOrder?: number }>,
): number {
  if (!items.length) return DEFAULT_LAST_EVENT_DURATION_MINUTES;
  const sorted = sortItemsByStartTime(
    items.map((item, index) => ({ ...item, sortOrder: item.sortOrder ?? index })),
  );
  let total = 0;
  for (let i = 0; i < sorted.length; i++) {
    const item = sorted[i]!;
    const next = sorted[i + 1];
    const nextStart = next ? timeToMinutes(next.startTime) : null;
    total += eventDurationMinutes(item, nextStart, i === sorted.length - 1);
  }
  return total;
}

export function computeDayWindowBlockLayouts(
  items: ProportionalDayEvent[],
  containerHeight: number,
): DayWindowLayout {
  const layout = buildProportionalDayRows(items, containerHeight);

  return {
    heightsById: layout.heightsById,
    totalHeight: layout.totalHeight,
    needsScroll: layout.needsScroll,
    minBlockHeightPx: layout.rows[0]?.minHeightPx ?? 0,
    windowMinutes: layout.windowMinutes,
  };
}

export { buildProportionalDayRows } from "./proportional-day-rows";
