export type {
  CalendarDaySlice,
  CalendarHalf,
  GroupCalendarMode,
  HalfSelection,
  PaintRangeOptions,
  SliceOverride,
} from "./types";

export {
  cityOnHalf,
  clearCityFromSlice,
  clearHalf,
  emptySlice,
  endingCityOnSlice,
  ensureSlicesInRange,
  fullDaySlice,
  indexSlices,
  isEmptySlice,
  isFullSingleCitySlice,
  isTravelSplitSlice,
  normalizeSlice,
  paintHalf,
  priorSliceCity,
  nextSliceCity,
  sliceHasPaint,
  sortedSliceValues,
  startingCityOnSlice,
  travelDaySlice,
} from "./slice-day";

export { paintRange } from "./paint-range";
export { clearRange } from "./clear-range";
export {
  alignStayToSlices,
  applyStayAlignedPaint,
  setDays,
  setDaysFromLegacy,
  slicesToLegacyDays,
} from "./set-days";
export { mergeOverrides, extractOverrides, projectGroupSlices } from "./merge-overrides";
export {
  dayPlaceToSlice,
  dayPlacesToSlices,
  isCitySplitDay,
  sliceToDayPlace,
  slicesToDayPlaces,
} from "./adapters";
export { assertSliceInvariants, assertMonotonicRange } from "./invariants";
export {
  clearPersonalOverlayLocationInSpan,
  isPersonalOverlayGroup,
  projectedDayPlacesForGroup,
} from "./group-helpers";
export { paintDayRangeForGroup, setDayPlacesForGroup, halfSideToSelection } from "./graph-bridge";
export {
  halfSideToSelection as halfSideToCalendarHalf,
  normalizeHalfSelection,
  selectionHalfToSide,
} from "./half-map";
