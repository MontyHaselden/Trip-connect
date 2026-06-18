import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { applyHalfDayPaint, clearAllLocationInSpan, paintLocationDayRange } from "./paint-day-range";
import { clearCalendarContentInRange } from "@/lib/host/setup/clear-day-content";
import type { TripSetupState } from "@/lib/host/setup/types";
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

  it("creates missing days and paints a multi-day range", () => {
    const days = [
      day("2026-07-10", "Bangkok"),
      day("2026-07-17", "Paris, France"),
    ];
    const out = paintLocationDayRange(
      days,
      "2026-07-10",
      "2026-07-16",
      "Paris, France",
      "right",
      "full",
    );
    assert.equal(out.find((d) => d.date === "2026-07-12")?.primaryCity, "Paris, France");
    assert.equal(out.find((d) => d.date === "2026-07-10")?.secondaryCity, "Paris, France");
    assert.equal(out.find((d) => d.date === "2026-07-10")?.primaryCity, "Bangkok");
    assert.equal(out.find((d) => d.date === "2026-07-16")?.primaryCity, "Paris, France");
    assert.equal(out.find((d) => d.date === "2026-07-16")?.primaryShare, 0.5);
    assert.equal(out.find((d) => d.date === "2026-07-17"), undefined);
  });
});

describe("clearAllLocationInSpan", () => {
  it("removes a single full-day orphan location", () => {
    const out = clearAllLocationInSpan([day("2026-07-17", "Paris, France")], {
      rangeStart: "2026-07-17",
      rangeEnd: "2026-07-17",
      startHalf: "full",
      endHalf: "full",
    });
    assert.equal(out.length, 0);
  });
});

describe("clearCalendarContentInRange single trip end day", () => {
  it("clears orphan Paris on the last trip day", () => {
    const state: TripSetupState = {
      basics: {
        name: "Trip",
        schoolName: "School",
        startDate: "2026-07-01",
        endDate: "2026-07-17",
        timezone: "UTC",
        departureCity: "Christchurch",
        returnCity: "Christchurch",
        defaultDepartureAirport: "",
        destinationCountries: [],
      },
      mainGroupId: "main",
      groups: [{ id: "main", name: "Main", type: "main", description: null, sortOrder: 0, isMain: true }],
      dayPlacesByGroupId: {
        main: [
          day("2026-07-10", "Bangkok"),
          day("2026-07-17", "Paris, France"),
        ],
      },
      outboundLegs: [],
      returnLegs: [],
      intercityLegs: [],
      accommodationStays: [],
      activities: [],
      overlayOps: [],
    };

    const next = clearCalendarContentInRange(
      state,
      {
        rangeStart: "2026-07-17",
        rangeEnd: "2026-07-17",
        startHalf: "full",
        endHalf: "full",
      },
      "main",
    );

    assert.equal(next.dayPlacesByGroupId.main?.find((d) => d.date === "2026-07-17"), undefined);
    assert.equal(next.dayPlacesByGroupId.main?.find((d) => d.date === "2026-07-10")?.primaryCity, "Bangkok");
  });
});
