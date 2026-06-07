import type { ItemLayoutSpans } from "./time-math";
import { MIN_DURATION_MINUTES } from "./time-math";

/** Minimum block height as a fraction of the list container (1/9 ≈ 11%). */
export const COMPACT_MIN_FRACTION = 1 / 9;

/** @deprecated Use height-based checks in CompactItineraryRow instead. */
export const COMPACT_SHORT_THRESHOLD_MINUTES = 60;

export type CompactBlockLayout = {
  heightsById: Map<string, number>;
  totalHeight: number;
  needsScroll: boolean;
  minBlockHeightPx: number;
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

export function computeCompactBlockLayouts(
  items: Array<{ id: string }>,
  layout: ItemLayoutSpans,
  containerHeight: number,
): CompactBlockLayout {
  const heightsById = new Map<string, number>();

  if (items.length === 0 || containerHeight <= 0) {
    return {
      heightsById,
      totalHeight: 0,
      needsScroll: false,
      minBlockHeightPx: 0,
    };
  }

  if (layout.soloFillId && items.length === 1) {
    heightsById.set(items[0]!.id, containerHeight);
    return {
      heightsById,
      totalHeight: containerHeight,
      needsScroll: false,
      minBlockHeightPx: containerHeight / 9,
    };
  }

  const minHeight = containerHeight * COMPACT_MIN_FRACTION;
  const locked = new Set(layout.lockedMinimumIds);

  if (locked.size * minHeight > containerHeight) {
    for (const item of items) {
      heightsById.set(item.id, Math.round(minHeight));
    }
    return {
      heightsById,
      totalHeight: Math.round(items.length * minHeight),
      needsScroll: true,
      minBlockHeightPx: minHeight,
    };
  }

  let changed = true;
  while (changed) {
    changed = false;
    const flexItems = items.filter((item) => !locked.has(item.id));
    const flexHeight = containerHeight - locked.size * minHeight;

    if (flexItems.length === 0) {
      break;
    }

    const totalSpan = flexItems.reduce(
      (sum, item) => sum + (layout.spanById.get(item.id) ?? MIN_DURATION_MINUTES),
      0,
    );

    for (const item of flexItems) {
      const span = layout.spanById.get(item.id) ?? MIN_DURATION_MINUTES;
      const share = totalSpan > 0 ? span / totalSpan : 1 / flexItems.length;
      const height = flexHeight * share;

      if (height < minHeight - 0.5) {
        locked.add(item.id);
        changed = true;
        break;
      }
    }
  }

  if (locked.size * minHeight > containerHeight) {
    for (const item of items) {
      heightsById.set(item.id, Math.round(minHeight));
    }
    return {
      heightsById,
      totalHeight: Math.round(items.length * minHeight),
      needsScroll: true,
      minBlockHeightPx: minHeight,
    };
  }

  const flexItems = items.filter((item) => !locked.has(item.id));
  const flexHeight = containerHeight - locked.size * minHeight;
  const rawHeights = new Map<string, number>();

  if (flexItems.length === 0) {
    for (const item of items) {
      rawHeights.set(item.id, minHeight);
    }
  } else {
    const totalSpan = flexItems.reduce(
      (sum, item) => sum + (layout.spanById.get(item.id) ?? MIN_DURATION_MINUTES),
      0,
    );

    for (const item of items) {
      if (locked.has(item.id)) {
        rawHeights.set(item.id, minHeight);
        continue;
      }

      const span = layout.spanById.get(item.id) ?? MIN_DURATION_MINUTES;
      const share = totalSpan > 0 ? span / totalSpan : 1 / flexItems.length;
      rawHeights.set(item.id, flexHeight * share);
    }
  }

  const rounded = roundHeightsToContainer(items, rawHeights, containerHeight);

  return {
    heightsById: rounded,
    totalHeight: containerHeight,
    needsScroll: false,
    minBlockHeightPx: minHeight,
  };
}
