import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { deriveCalendarState } from "@/lib/host/setup/derive-calendar";
import { bangkokStay, patongBangkokTrip } from "@/lib/host/setup/calendar-fixtures";
import { pruneOrphanStoredLocations } from "@/lib/host/setup/derive-calendar";

describe("pruneOrphanStoredLocations", () => {
  it("removes stored Bangkok paint beyond a shorter named stay", () => {
    const named = [bangkokStay({ checkInDate: "2026-08-31", checkOutDate: "2026-09-03" })];
    const stored = [
      {
        date: "2026-09-02",
        primaryCity: "Bangkok",
        secondaryCity: null,
        primaryShare: 1,
        dayType: "trip" as const,
        includeBuffer: false,
      },
      {
        date: "2026-09-10",
        primaryCity: "Bangkok",
        secondaryCity: null,
        primaryShare: 1,
        dayType: "trip" as const,
        includeBuffer: false,
      },
    ];

    const pruned = pruneOrphanStoredLocations(stored, named);
    assert.deepEqual(pruned.map((d) => d.date), ["2026-09-02"]);
  });
});

describe("deriveCalendarState stay sync", () => {
  it("does not resurrect orphan location when stay ends before stored paint", () => {
    const named = [bangkokStay({ checkInDate: "2026-08-31", checkOutDate: "2026-09-03" })];
    const stored = [
      {
        date: "2026-09-10",
        primaryCity: "Bangkok",
        secondaryCity: null,
        primaryShare: 1,
        dayType: "trip" as const,
        includeBuffer: false,
      },
    ];

    const derived = deriveCalendarState({
      stays: named,
      intercityLegs: [],
      trip: patongBangkokTrip,
      transportDraft: {
        outboundLegs: [],
        returnLegs: [],
        intercityLegs: [],
        dayPlaces: stored,
      },
      gridStart: "2026-08-31",
      gridEnd: "2026-09-12",
    });

    assert.equal(derived.dayPlaces.find((d) => d.date === "2026-09-10")?.primaryCity, "");
    assert.equal(derived.accommodationByDate.get("2026-09-02"), "Centre Point Plus");
  });
});
