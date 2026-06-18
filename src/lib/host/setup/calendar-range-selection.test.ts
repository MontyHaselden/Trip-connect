import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  EMPTY_CALENDAR_SELECTION,
  expandHalfSelectionToFullDay,
  nextCalendarRangeSelection,
} from "./calendar-range-selection";

describe("nextCalendarRangeSelection", () => {
  it("anchors on first click", () => {
    const result = nextCalendarRangeSelection(EMPTY_CALENDAR_SELECTION, "2026-08-21");
    assert.deepEqual(result, {
      selected: true,
      selection: {
        rangeStart: "2026-08-21",
        rangeEnd: "2026-08-21",
        startHalf: "full",
        endHalf: "full",
      },
    });
  });

  it("extends the range on a second forward click", () => {
    const anchored = {
      rangeStart: "2026-08-21",
      rangeEnd: "2026-08-21",
      startHalf: "full" as const,
      endHalf: "full" as const,
    };
    const result = nextCalendarRangeSelection(anchored, "2026-08-22");
    assert.deepEqual(result.selection, {
      rangeStart: "2026-08-21",
      rangeEnd: "2026-08-22",
      startHalf: "full",
      endHalf: "full",
    });
  });

  it("clears a single-day selection when the same day is clicked again", () => {
    const anchored = {
      rangeStart: "2026-08-21",
      rangeEnd: "2026-08-21",
      startHalf: "full" as const,
      endHalf: "full" as const,
    };
    const result = nextCalendarRangeSelection(anchored, "2026-08-21");
    assert.equal(result.selected, false);
    assert.deepEqual(result.selection, EMPTY_CALENDAR_SELECTION);
  });

  it("re-anchors when clicking inside an existing multi-day range", () => {
    const range = {
      rangeStart: "2026-08-21",
      rangeEnd: "2026-08-23",
      startHalf: "full" as const,
      endHalf: "full" as const,
    };
    const result = nextCalendarRangeSelection(range, "2026-08-22");
    assert.deepEqual(result.selection, {
      rangeStart: "2026-08-22",
      rangeEnd: "2026-08-22",
      startHalf: "full",
      endHalf: "full",
    });
  });

  it("preserves a half-day anchor when extending forward", () => {
    const halfDay = {
      rangeStart: "2026-07-05",
      rangeEnd: "2026-07-05",
      startHalf: "right" as const,
      endHalf: "right" as const,
    };
    const result = nextCalendarRangeSelection(halfDay, "2026-07-08");
    assert.deepEqual(result.selection, {
      rangeStart: "2026-07-05",
      rangeEnd: "2026-07-08",
      startHalf: "right",
      endHalf: "full",
    });
  });

  it("can extend an existing multi-day range to a later day", () => {
    const range = {
      rangeStart: "2026-08-20",
      rangeEnd: "2026-08-21",
      startHalf: "right" as const,
      endHalf: "left" as const,
    };
    const result = nextCalendarRangeSelection(range, "2026-08-22");
    assert.deepEqual(result.selection, {
      rangeStart: "2026-08-20",
      rangeEnd: "2026-08-22",
      startHalf: "right",
      endHalf: "full",
    });
  });
});

describe("expandHalfSelectionToFullDay", () => {
  it("expands a repeated half-day click to the full day", () => {
    const halfDay = {
      rangeStart: "2026-07-10",
      rangeEnd: "2026-07-10",
      startHalf: "right" as const,
      endHalf: "right" as const,
    };
    assert.deepEqual(expandHalfSelectionToFullDay(halfDay, "2026-07-10", "right"), {
      rangeStart: "2026-07-10",
      rangeEnd: "2026-07-10",
      startHalf: "full",
      endHalf: "full",
    });
  });

  it("returns null when the half does not match the current selection", () => {
    const halfDay = {
      rangeStart: "2026-07-10",
      rangeEnd: "2026-07-10",
      startHalf: "right" as const,
      endHalf: "right" as const,
    };
    assert.equal(expandHalfSelectionToFullDay(halfDay, "2026-07-10", "left"), null);
  });
});
