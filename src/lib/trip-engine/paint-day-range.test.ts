import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { applyHalfDayPaint } from "./paint-day-range";
import type { DayPlaceDraft } from "@/lib/host/wizard/types";

function day(date: string, primary = "", secondary: string | null = null): DayPlaceDraft {
  return {
    date,
    primaryCity: primary,
    secondaryCity: secondary,
    primaryShare: 1,
    dayType: "trip",
    includeBuffer: false,
  };
}

describe("applyHalfDayPaint", () => {
  it("paints right half on single day", () => {
    const days = [day("2026-08-23", "Patong")];
    const out = applyHalfDayPaint(days, "2026-08-23", "2026-08-23", "Bangkok", "right", "right");
    assert.equal(out[0].secondaryCity, "Bangkok");
    assert.equal(out[0].primaryShare, 0.5);
  });

  it("leaves days unchanged when halves are full", () => {
    const days = [day("2026-08-23", "Patong")];
    const out = applyHalfDayPaint(days, "2026-08-23", "2026-08-23", "Bangkok", "full", "full");
    assert.deepEqual(out, days);
  });
});
