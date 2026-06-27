import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { applyHalfDayPaint, clearAllLocationInSpan, paintLocationDayRange, paintLocationDayRangeProtected, repairIntercityTransitionDays } from "./paint-day-range";
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
    assert.equal(out.find((d) => d.date === "2026-07-16")?.primaryShare, 1);
    assert.equal(out.find((d) => d.date === "2026-07-17"), undefined);
  });

  it("paints stay-aligned halves for full/full multi-day location paint on empty calendar", () => {
    const out = paintLocationDayRange(
      [],
      "2026-12-05",
      "2026-12-08",
      "Kagoshima",
      "full",
      "full",
    );
    const dec5 = out.find((d) => d.date === "2026-12-05");
    const dec6 = out.find((d) => d.date === "2026-12-06");
    const dec7 = out.find((d) => d.date === "2026-12-07");
    const dec8 = out.find((d) => d.date === "2026-12-08");
    assert.equal(dec5?.secondaryCity, "Kagoshima");
    assert.ok((dec5?.primaryShare ?? 1) < 0.99);
    assert.equal(dec6?.primaryCity, "Kagoshima");
    assert.equal(dec6?.primaryShare, 1);
    assert.equal(dec7?.primaryCity, "Kagoshima");
    assert.equal(dec7?.primaryShare, 1);
    assert.equal(dec8?.primaryCity, "Kagoshima");
    assert.ok((dec8?.primaryShare ?? 1) < 0.99);
  });

  it("paints arrival and checkout halves for a two-day Tokyo selection", () => {
    const out = paintLocationDayRange(
      [],
      "2026-12-05",
      "2026-12-06",
      "Tokyo",
      "full",
      "full",
    );
    const dec5 = out.find((d) => d.date === "2026-12-05");
    const dec6 = out.find((d) => d.date === "2026-12-06");
    assert.equal(dec5?.secondaryCity, "Tokyo");
    assert.equal(dec5?.primaryCity, "");
    assert.equal(dec6?.primaryCity, "Tokyo");
    assert.equal(dec6?.secondaryCity, null);
    assert.ok((dec5?.primaryShare ?? 1) < 0.99);
    assert.ok((dec6?.primaryShare ?? 1) < 0.99);
  });

  it("paints arrival half-day when full/full range starts after a different city", () => {
    const days = [
      {
        date: "2026-12-05",
        primaryCity: "",
        secondaryCity: "Tokyo",
        primaryShare: 0.5,
        dayType: "trip" as const,
        includeBuffer: false,
      },
    ];
    const out = paintLocationDayRange(
      days,
      "2026-12-06",
      "2026-12-13",
      "Kagoshima",
      "full",
      "full",
    );
    const dec6 = out.find((d) => d.date === "2026-12-06");
    const dec7 = out.find((d) => d.date === "2026-12-07");
    assert.equal(dec6?.primaryCity, "Tokyo");
    assert.equal(dec6?.secondaryCity, "Kagoshima");
    assert.equal(dec6?.primaryShare, 0.5);
    assert.equal(dec7?.primaryCity, "Kagoshima");
    assert.equal(dec7?.primaryShare, 1);
  });

  it("does not touch days before a full/full multi-day Hiroshima paint", () => {
    const days = [
      {
        date: "2026-12-12",
        primaryCity: "Kagoshima",
        secondaryCity: null,
        primaryShare: 0.5,
        dayType: "trip" as const,
        includeBuffer: false,
      },
    ];
    const out = paintLocationDayRange(
      days,
      "2026-12-13",
      "2026-12-15",
      "Hiroshima",
      "full",
      "full",
    );
    const dec12 = out.find((d) => d.date === "2026-12-12");
    const dec13 = out.find((d) => d.date === "2026-12-13");
    const dec15 = out.find((d) => d.date === "2026-12-15");
    assert.equal(dec12?.primaryCity, "Kagoshima");
    assert.equal(dec12?.secondaryCity, null);
    assert.equal(dec13?.primaryCity, "Kagoshima");
    assert.equal(dec13?.secondaryCity, "Hiroshima");
    assert.equal(dec13?.primaryShare, 0.5);
    assert.equal(dec15?.primaryCity, "Hiroshima");
    assert.ok((dec15?.primaryShare ?? 1) < 0.99);
  });

  it("clears an erroneous evening city when repainting morning halves only", () => {
    const days = [
      {
        date: "2026-12-12",
        primaryCity: "Kagoshima",
        secondaryCity: "Hiroshima",
        primaryShare: 0.5,
        dayType: "travel" as const,
        includeBuffer: false,
      },
      {
        date: "2026-12-13",
        primaryCity: "Kagoshima",
        secondaryCity: "Hiroshima",
        primaryShare: 0.5,
        dayType: "travel" as const,
        includeBuffer: false,
      },
      {
        date: "2026-12-14",
        primaryCity: "Hiroshima",
        secondaryCity: null,
        primaryShare: 1,
        dayType: "trip" as const,
        includeBuffer: false,
      },
    ];
    const out = paintLocationDayRangeProtected(
      days,
      "2026-12-12",
      "2026-12-13",
      "Kagoshima",
      "left",
      "left",
    );
    const dec12 = out.find((d) => d.date === "2026-12-12");
    const dec13 = out.find((d) => d.date === "2026-12-13");
    const dec14 = out.find((d) => d.date === "2026-12-14");
    assert.equal(dec12?.primaryCity, "Kagoshima");
    assert.equal(dec12?.secondaryCity, null);
    assert.equal(dec13?.primaryCity, "Kagoshima");
    assert.equal(dec13?.secondaryCity, null);
    assert.equal(dec14?.primaryCity, "Hiroshima");
  });

  it("preserves departure city when painting from the second half of a travel day", () => {
    const days = [
      {
        date: "2026-12-15",
        primaryCity: "Hiroshima",
        secondaryCity: "Kyoto",
        primaryShare: 0.5,
        dayType: "travel" as const,
        includeBuffer: false,
      },
    ];
    const out = paintLocationDayRange(
      days,
      "2026-12-15",
      "2026-12-17",
      "Kyoto",
      "right",
      "left",
    );
    const dec15 = out.find((d) => d.date === "2026-12-15");
    assert.equal(dec15?.primaryCity, "Hiroshima");
    assert.equal(dec15?.secondaryCity, "Kyoto");
    assert.equal(dec15?.primaryShare, 0.5);
  });

  it("protected paint preserves travel split at range end", () => {
    const days = [
      ...["2026-12-07", "2026-12-08", "2026-12-09", "2026-12-10", "2026-12-11", "2026-12-12"].map(
        (date) => day(date, "Kagoshima"),
      ),
      {
        date: "2026-12-13",
        primaryCity: "Kagoshima",
        secondaryCity: "Hiroshima",
        primaryShare: 0.5,
        dayType: "travel" as const,
        includeBuffer: false,
      },
    ];
    const out = paintLocationDayRangeProtected(
      days,
      "2026-12-07",
      "2026-12-13",
      "Kagoshima",
      "full",
      "full",
    );
    const dec13 = out.find((d) => d.date === "2026-12-13");
    assert.equal(dec13?.secondaryCity, "Hiroshima");
    assert.equal(dec13?.primaryShare, 0.5);
  });

  it("preserves travel split when painting through first half of checkout day", () => {
    const days = [
      ...["2026-12-07", "2026-12-08", "2026-12-09", "2026-12-10", "2026-12-11", "2026-12-12"].map(
        (date) => day(date, "Tokyo"),
      ),
      {
        date: "2026-12-13",
        primaryCity: "Kagoshima",
        secondaryCity: "Hiroshima",
        primaryShare: 0.5,
        dayType: "travel" as const,
        includeBuffer: false,
      },
    ];
    const out = paintLocationDayRangeProtected(
      days,
      "2026-12-05",
      "2026-12-13",
      "Kagoshima",
      "right",
      "left",
    );
    const dec13 = out.find((d) => d.date === "2026-12-13");
    assert.equal(dec13?.primaryCity, "Kagoshima");
    assert.equal(dec13?.secondaryCity, "Hiroshima");
    assert.equal(dec13?.primaryShare, 0.5);
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

  it("restores departure half-day when clearing a full incoming city on range start", () => {
    const days = [
      {
        date: "2026-12-05",
        primaryCity: "",
        secondaryCity: "Tokyo",
        primaryShare: 0.5,
        dayType: "trip" as const,
        includeBuffer: false,
      },
      {
        date: "2026-12-06",
        primaryCity: "Kagoshima",
        secondaryCity: null,
        primaryShare: 1,
        dayType: "trip" as const,
        includeBuffer: false,
      },
      ...["2026-12-07", "2026-12-08", "2026-12-09", "2026-12-10", "2026-12-11", "2026-12-12", "2026-12-13"].map(
        (date) => day(date, "Kagoshima"),
      ),
    ];
    const out = clearAllLocationInSpan(days, {
      rangeStart: "2026-12-06",
      rangeEnd: "2026-12-13",
      startHalf: "full",
      endHalf: "full",
    });
    const dec6 = out.find((d) => d.date === "2026-12-06");
    assert.equal(dec6?.primaryCity, "Tokyo");
    assert.equal(dec6?.secondaryCity, null);
    assert.equal(dec6?.primaryShare, 0.5);
    assert.equal(out.find((d) => d.date === "2026-12-07"), undefined);
  });

  it("keeps departure half-day when clearing only the arrival city on a travel split", () => {
    const days = [
      {
        date: "2026-12-05",
        primaryCity: "",
        secondaryCity: "Tokyo",
        primaryShare: 0.5,
        dayType: "trip" as const,
        includeBuffer: false,
      },
      {
        date: "2026-12-06",
        primaryCity: "Tokyo",
        secondaryCity: "Kagoshima",
        primaryShare: 0.5,
        dayType: "travel" as const,
        includeBuffer: false,
      },
      day("2026-12-07", "Kagoshima"),
    ];
    const out = clearAllLocationInSpan(days, {
      rangeStart: "2026-12-06",
      rangeEnd: "2026-12-07",
      startHalf: "full",
      endHalf: "full",
    });
    const dec6 = out.find((d) => d.date === "2026-12-06");
    assert.equal(dec6?.primaryCity, "Tokyo");
    assert.equal(dec6?.secondaryCity, null);
    assert.equal(dec6?.primaryShare, 0.5);
  });
});

describe("repairIntercityTransitionDays", () => {
  it("repairs stale full incoming city into a travel split", () => {
    const days = [
      {
        date: "2026-12-05",
        primaryCity: "",
        secondaryCity: "Tokyo",
        primaryShare: 0.5,
        dayType: "trip" as const,
        includeBuffer: false,
      },
      {
        date: "2026-12-06",
        primaryCity: "Kagoshima",
        secondaryCity: null,
        primaryShare: 1,
        dayType: "trip" as const,
        includeBuffer: false,
      },
      day("2026-12-07", "Kagoshima"),
    ];
    const out = repairIntercityTransitionDays(days);
    const dec6 = out.find((d) => d.date === "2026-12-06");
    assert.equal(dec6?.primaryCity, "Tokyo");
    assert.equal(dec6?.secondaryCity, "Kagoshima");
    assert.equal(dec6?.primaryShare, 0.5);
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
