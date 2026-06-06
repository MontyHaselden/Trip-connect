/** Fixed height for short activity blocks (px). */
export const COMPACT_MIN_BLOCK_PX = 48;

/** Activities at or below this duration use the fixed minimum height. */
export const COMPACT_SHORT_THRESHOLD_MINUTES = 60;

/** Pixels per minute for long blocks (4 hr → 360px at 1.5). */
export const COMPACT_PX_PER_MINUTE = 1.5;

export type CompactBlockLayout = {
  heightsById: Map<string, number>;
  totalHeight: number;
  needsScroll: boolean;
};

export function computeCompactBlockLayouts(
  items: Array<{ id: string }>,
  durationById: Map<string, number>,
  containerHeight: number,
): CompactBlockLayout {
  const heightsById = new Map<string, number>();

  if (items.length === 0 || containerHeight <= 0) {
    return { heightsById, totalHeight: 0, needsScroll: false };
  }

  const specs = items.map((item) => {
    const durationMinutes = durationById.get(item.id) ?? 60;
    const isShort = durationMinutes <= COMPACT_SHORT_THRESHOLD_MINUTES;
    const baseHeight = isShort
      ? COMPACT_MIN_BLOCK_PX
      : Math.round(durationMinutes * COMPACT_PX_PER_MINUTE);
    return { id: item.id, durationMinutes, isShort, baseHeight };
  });

  const baseTotal = specs.reduce((sum, spec) => sum + spec.baseHeight, 0);

  if (baseTotal <= containerHeight) {
    const extra = containerHeight - baseTotal;
    const longSpecs = specs.filter((spec) => !spec.isShort);
    const longBaseTotal = longSpecs.reduce((sum, spec) => sum + spec.baseHeight, 0);

    if (longSpecs.length === 0) {
      const extraPerItem = extra / specs.length;
      for (const spec of specs) {
        heightsById.set(spec.id, Math.round(COMPACT_MIN_BLOCK_PX + extraPerItem));
      }
    } else {
      for (const spec of specs) {
        if (spec.isShort) {
          heightsById.set(spec.id, COMPACT_MIN_BLOCK_PX);
        } else {
          const share = spec.baseHeight / longBaseTotal;
          heightsById.set(spec.id, Math.round(spec.baseHeight + extra * share));
        }
      }
    }

    return {
      heightsById,
      totalHeight: containerHeight,
      needsScroll: false,
    };
  }

  for (const spec of specs) {
    heightsById.set(spec.id, spec.baseHeight);
  }

  return {
    heightsById,
    totalHeight: baseTotal,
    needsScroll: true,
  };
}
