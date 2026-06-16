import { MIN_DURATION_MINUTES, sortItemsByStartTime, timeToMinutes } from "./time-math";

/** Minimum readable row height in px. */
export const PROPORTIONAL_MIN_ROW_HEIGHT_PX = 56;

/** Default duration when the last event has no end time. */
export const DEFAULT_LAST_EVENT_DURATION_MINUTES = 30;

export type ProportionalDayEvent = {
  id: string;
  startTime: string;
  endTime: string | null;
  sortOrder?: number;
};

export type ProportionalDayRow = {
  id: string;
  durationMinutes: number;
  heightPercent: number;
  minHeightPx: number;
  heightPx: number;
};

export type ProportionalDayLayout = {
  rows: ProportionalDayRow[];
  heightsById: Map<string, number>;
  totalHeight: number;
  needsScroll: boolean;
  windowMinutes: number;
};

function roundHeightsToContainer(
  items: Array<{ id: string }>,
  rawHeights: Map<string, number>,
  containerHeight: number,
): Map<string, number> {
  const heightsById = new Map<string, number>();
  let assigned = 0;

  for (let i = 0; i < items.length; i++) {
    const item = items[i]!;
    const isLast = i === items.length - 1;
    const raw = rawHeights.get(item.id) ?? 0;
    const height = isLast
      ? Math.max(0, containerHeight - assigned)
      : Math.round(raw);
    heightsById.set(item.id, height);
    assigned += height;
  }

  return heightsById;
}

/** Duration for proportional sizing (full gaps, no 1h display cap). */
export function eventDurationMinutes(
  event: { startTime: string; endTime: string | null },
  nextStartMinutes: number | null,
  isLast: boolean,
): number {
  const start = timeToMinutes(event.startTime);

  if (event.endTime) {
    const end = timeToMinutes(event.endTime);
    return Math.max(MIN_DURATION_MINUTES, end - start);
  }

  if (isLast) {
    return DEFAULT_LAST_EVENT_DURATION_MINUTES;
  }

  if (nextStartMinutes !== null && nextStartMinutes > start) {
    return Math.max(MIN_DURATION_MINUTES, nextStartMinutes - start);
  }

  return DEFAULT_LAST_EVENT_DURATION_MINUTES;
}

export function computeEventDurationsById(
  events: ProportionalDayEvent[],
): Map<string, number> {
  const sorted = sortItemsByStartTime(
    events.map((event, index) => ({ ...event, sortOrder: event.sortOrder ?? index })),
  );
  const durations = new Map<string, number>();

  for (let i = 0; i < sorted.length; i++) {
    const event = sorted[i]!;
    const next = sorted[i + 1];
    const nextStart = next ? timeToMinutes(next.startTime) : null;
    durations.set(
      event.id,
      eventDurationMinutes(event, nextStart, i === sorted.length - 1),
    );
  }

  return durations;
}

/**
 * Assign row heights proportional to event duration within the day viewport.
 * Short transfer/meal rows lock to minHeightPx; long gaps absorb remaining space.
 */
export function buildProportionalDayRows(
  events: ProportionalDayEvent[],
  containerHeightPx: number,
): ProportionalDayLayout {
  const heightsById = new Map<string, number>();
  const rows: ProportionalDayRow[] = [];

  if (events.length === 0 || containerHeightPx <= 0) {
    return {
      rows,
      heightsById,
      totalHeight: 0,
      needsScroll: false,
      windowMinutes: DEFAULT_LAST_EVENT_DURATION_MINUTES,
    };
  }

  const sorted = sortItemsByStartTime(
    events.map((event, index) => ({ ...event, sortOrder: event.sortOrder ?? index })),
  );
  const durationById = computeEventDurationsById(sorted);
  const windowMinutes = [...durationById.values()].reduce((sum, d) => sum + d, 0);
  const minHeight = Math.min(
    PROPORTIONAL_MIN_ROW_HEIGHT_PX,
    containerHeightPx / Math.max(1, sorted.length),
  );
  const locked = new Set<string>();

  let changed = true;
  while (changed) {
    changed = false;
    const flexItems = sorted.filter((item) => !locked.has(item.id));
    const flexHeight = containerHeightPx - locked.size * minHeight;

    if (flexItems.length === 0) break;

    const totalDuration = flexItems.reduce(
      (sum, item) => sum + (durationById.get(item.id) ?? MIN_DURATION_MINUTES),
      0,
    );

    for (const item of flexItems) {
      const duration = durationById.get(item.id) ?? MIN_DURATION_MINUTES;
      const share = totalDuration > 0 ? duration / totalDuration : 1 / flexItems.length;
      const height = flexHeight * share;

      if (height < minHeight - 0.5) {
        locked.add(item.id);
        changed = true;
        break;
      }
    }
  }

  if (locked.size * minHeight > containerHeightPx) {
    for (const item of sorted) {
      heightsById.set(item.id, Math.round(minHeight));
    }

    for (const item of sorted) {
      const duration = durationById.get(item.id) ?? MIN_DURATION_MINUTES;
      rows.push({
        id: item.id,
        durationMinutes: duration,
        heightPercent: windowMinutes > 0 ? (duration / windowMinutes) * 100 : 0,
        minHeightPx: minHeight,
        heightPx: minHeight,
      });
    }

    return {
      rows,
      heightsById,
      totalHeight: Math.round(sorted.length * minHeight),
      needsScroll: true,
      windowMinutes,
    };
  }

  const flexItems = sorted.filter((item) => !locked.has(item.id));
  const flexHeight = containerHeightPx - locked.size * minHeight;
  const rawHeights = new Map<string, number>();

  if (flexItems.length === 0) {
    for (const item of sorted) {
      rawHeights.set(item.id, minHeight);
    }
  } else {
    const totalDuration = flexItems.reduce(
      (sum, item) => sum + (durationById.get(item.id) ?? MIN_DURATION_MINUTES),
      0,
    );

    for (const item of sorted) {
      if (locked.has(item.id)) {
        rawHeights.set(item.id, minHeight);
        continue;
      }
      const duration = durationById.get(item.id) ?? MIN_DURATION_MINUTES;
      const share = totalDuration > 0 ? duration / totalDuration : 1 / flexItems.length;
      rawHeights.set(item.id, flexHeight * share);
    }
  }

  const rounded = roundHeightsToContainer(sorted, rawHeights, containerHeightPx);

  for (const item of sorted) {
    const duration = durationById.get(item.id) ?? MIN_DURATION_MINUTES;
    const heightPx = rounded.get(item.id) ?? minHeight;
    rows.push({
      id: item.id,
      durationMinutes: duration,
      heightPercent: windowMinutes > 0 ? (duration / windowMinutes) * 100 : 0,
      minHeightPx: minHeight,
      heightPx,
    });
    heightsById.set(item.id, heightPx);
  }

  return {
    rows,
    heightsById: rounded,
    totalHeight: containerHeightPx,
    needsScroll: locked.size > 0 && sorted.length * minHeight > containerHeightPx,
    windowMinutes,
  };
}
