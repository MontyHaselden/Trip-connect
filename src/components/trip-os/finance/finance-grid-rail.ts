/** Shared left-rail sizing for the finance spreadsheet. */
export const financeRailWidthClass = "w-[4.25rem] min-w-[4.25rem]";

export const financeSectionRailLabelClass =
  "text-[8px] font-bold uppercase leading-[1.15] tracking-wide text-zinc-500";

export const financeSectionSummaryBg = "bg-zinc-300";

export const financeSectionSummaryLabelClass =
  "text-[10px] font-semibold leading-snug tracking-wide text-zinc-800";

/** Inset edge that survives horizontal scroll (collapsed table borders do not). */
const financeStickyEdgeRight = "shadow-[inset_-1px_0_0_0_#a1a1aa]";
const financeStickyEdgeLeft = "shadow-[inset_1px_0_0_0_#a1a1aa]";

export const financeRailStickyLeft = [
  `sticky left-0 z-20 bg-white ${financeRailWidthClass}`,
  financeStickyEdgeRight,
].join(" ");

export const financeDescStickyLeft = [
  "sticky left-[4.25rem] z-20 bg-white",
  financeStickyEdgeLeft,
  financeStickyEdgeRight,
].join(" ");

export const financeHeadRailSticky = [
  `sticky top-0 z-40 left-0 bg-white ${financeRailWidthClass}`,
  financeStickyEdgeRight,
].join(" ");

export const financeHeadDescSticky = [
  "sticky top-0 z-30 left-[4.25rem] bg-white",
  financeStickyEdgeLeft,
  financeStickyEdgeRight,
].join(" ");
