import type { TimelineBlockLayout, TimelineItemBase } from "./types";
import {
  durationToHeightPx,
  getDisplayEndMinutes,
  minutesToTopPx,
  sortItemsByStartTime,
  timeToMinutes,
} from "./time-math";

type WorkingItem = {
  id: string;
  startMinutes: number;
  endMinutes: number;
  column: number;
};

function overlaps(a: WorkingItem, b: WorkingItem): boolean {
  return a.startMinutes < b.endMinutes && b.startMinutes < a.endMinutes;
}

function assignColumns(sorted: WorkingItem[]): void {
  const columnEnds: number[] = [];

  for (const item of sorted) {
    let placed = false;
    for (let col = 0; col < columnEnds.length; col++) {
      if (columnEnds[col]! <= item.startMinutes) {
        item.column = col;
        columnEnds[col] = item.endMinutes;
        placed = true;
        break;
      }
    }
    if (!placed) {
      item.column = columnEnds.length;
      columnEnds.push(item.endMinutes);
    }
  }
}

function clusterItems(sorted: WorkingItem[]): WorkingItem[][] {
  const clusters: WorkingItem[][] = [];
  let current: WorkingItem[] = [];
  let clusterEnd = 0;

  for (const item of sorted) {
    if (current.length && item.startMinutes >= clusterEnd) {
      clusters.push(current);
      current = [];
      clusterEnd = 0;
    }
    current.push(item);
    clusterEnd = Math.max(clusterEnd, item.endMinutes);
  }
  if (current.length) clusters.push(current);
  return clusters;
}

export function layoutTimelineItems(items: TimelineItemBase[]): TimelineBlockLayout[] {
  const sorted = sortItemsByStartTime(items);
  const starts = sorted.map((i) => timeToMinutes(i.startTime));

  const working: WorkingItem[] = sorted.map((item, index) => {
    const startMinutes = timeToMinutes(item.startTime);
    const nextStart = starts[index + 1] ?? null;
    const endMinutes = getDisplayEndMinutes(
      startMinutes,
      item.endTime,
      nextStart,
    );
    return { id: item.id, startMinutes, endMinutes, column: 0 };
  });

  assignColumns(working);

  const byId = new Map(working.map((w) => [w.id, w]));
  const clusters = clusterItems(working);
  const layouts: TimelineBlockLayout[] = [];

  for (const cluster of clusters) {
    const columnCount = Math.max(...cluster.map((c) => c.column), 0) + 1;
    for (const item of cluster) {
      const duration = item.endMinutes - item.startMinutes;
      layouts.push({
        id: item.id,
        startMinutes: item.startMinutes,
        endMinutes: item.endMinutes,
        column: item.column,
        columnCount,
        topPx: minutesToTopPx(item.startMinutes),
        heightPx: durationToHeightPx(duration),
        leftPercent: (item.column / columnCount) * 100,
        widthPercent: 100 / columnCount,
      });
    }
  }

  // Preserve input order not needed; return sorted by top
  layouts.sort((a, b) => a.topPx - b.topPx || a.leftPercent - b.leftPercent);
  return layouts;
}

export function findBlockAtPoint(
  layouts: TimelineBlockLayout[],
  minutes: number,
  lanePercent: number,
): TimelineBlockLayout | null {
  const hits = layouts.filter(
    (l) => minutes >= l.startMinutes && minutes < l.endMinutes,
  );
  if (!hits.length) return null;
  return (
    hits.find((l) => {
      const left = l.leftPercent;
      const right = l.leftPercent + l.widthPercent;
      return lanePercent >= left && lanePercent < right;
    }) ?? hits[0]!
  );
}

export function layoutById(
  layouts: TimelineBlockLayout[],
): Map<string, TimelineBlockLayout> {
  return new Map(layouts.map((l) => [l.id, l]));
}

export function mergeLayoutIntoItems<T extends TimelineItemBase>(
  items: T[],
  layouts: TimelineBlockLayout[],
): Array<T & { layout: TimelineBlockLayout }> {
  const map = layoutById(layouts);
  return sortItemsByStartTime(items)
    .filter((item) => map.has(item.id))
    .map((item) => ({ ...item, layout: map.get(item.id)! }));
}
