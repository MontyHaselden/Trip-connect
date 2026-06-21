import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  mergeSetDayPlacesDays,
  sanitizeDayPlaceDraft,
  sanitizeDayType,
} from "./sanitize-day-place";

describe("sanitizeDayType", () => {
  it("keeps valid day types", () => {
    assert.equal(sanitizeDayType("travel"), "travel");
  });

  it("coerces invented values like stay to trip", () => {
    assert.equal(sanitizeDayType("stay"), "trip");
    assert.equal(sanitizeDayType(undefined), "trip");
  });
});

describe("mergeSetDayPlacesDays", () => {
  it("merges partial AI updates onto the existing calendar", () => {
    const existing = [
      sanitizeDayPlaceDraft({
        date: "2026-06-15",
        primaryCity: "Paris",
        dayType: "trip",
      }),
      sanitizeDayPlaceDraft({
        date: "2026-06-16",
        primaryCity: "Paris",
        dayType: "trip",
      }),
    ];
    const incoming = [
      sanitizeDayPlaceDraft({
        date: "2026-06-16",
        primaryCity: "London",
        dayType: "stay" as never,
      }),
    ];
    const merged = mergeSetDayPlacesDays(existing, incoming);
    assert.equal(merged.length, 2);
    assert.equal(merged.find((d) => d.date === "2026-06-16")?.primaryCity, "London");
    assert.equal(merged.find((d) => d.date === "2026-06-16")?.dayType, "trip");
  });
});
