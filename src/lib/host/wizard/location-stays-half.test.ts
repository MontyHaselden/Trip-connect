import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  cityOnHalf,
  getEmptyHalf,
  halfFromClickX,
  isHalfEmpty,
  isSplitDay,
} from "@/lib/host/wizard/location-stays";
import type { DayPlaceDraft } from "@/lib/host/wizard/types";

function day(overrides: Partial<DayPlaceDraft> = {}): DayPlaceDraft {
  return {
    date: "2026-09-01",
    primaryCity: "Patong",
    secondaryCity: null,
    primaryShare: 0.5,
    dayType: "trip",
    includeBuffer: false,
    ...overrides,
  };
}

describe("half-day helpers", () => {
  it("detects checkout half-day with empty right side", () => {
    const d = day();
    assert.equal(isSplitDay(d), true);
    assert.equal(getEmptyHalf(d), "right");
    assert.equal(isHalfEmpty(d, "right"), true);
    assert.equal(isHalfEmpty(d, "left"), false);
    assert.equal(cityOnHalf(d, "left"), "Patong");
    assert.equal(cityOnHalf(d, "right"), "");
  });

  it("maps click x to left or right half", () => {
    const d = day();
    const rect = { left: 0, width: 100 };
    assert.equal(halfFromClickX(20, rect, d), "left");
    assert.equal(halfFromClickX(80, rect, d), "right");
  });
});
