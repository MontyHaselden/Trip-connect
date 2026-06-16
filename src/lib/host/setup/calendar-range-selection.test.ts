import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  EMPTY_CALENDAR_SELECTION,
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
      startHalf: "full",
      endHalf: "full",
    });
  });
});
