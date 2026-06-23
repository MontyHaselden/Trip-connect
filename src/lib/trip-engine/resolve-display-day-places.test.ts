import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { DEFAULT_HALF_SHARE } from "@/lib/host/wizard/location-stays";

import { fillIncompleteSplitDays, resolveDisplayDayPlaces } from "./resolve-display-day-places";

describe("resolveDisplayDayPlaces", () => {
  it("prefers stored half-day paint over derived full-day paint", () => {
    const stored = [
      {
        date: "2026-12-07",
        primaryCity: "",
        secondaryCity: "Kagoshima",
        primaryShare: DEFAULT_HALF_SHARE,
        dayType: "trip" as const,
        includeBuffer: false,
      },
      {
        date: "2026-12-11",
        primaryCity: "Kagoshima",
        secondaryCity: null,
        primaryShare: 1,
        dayType: "trip" as const,
        includeBuffer: false,
      },
    ];
    const derived = [
      {
        date: "2026-12-07",
        primaryCity: "Kagoshima",
        secondaryCity: null,
        primaryShare: 1,
        dayType: "trip" as const,
        includeBuffer: false,
      },
      {
        date: "2026-12-11",
        primaryCity: "Kagoshima",
        secondaryCity: null,
        primaryShare: 1,
        dayType: "trip" as const,
        includeBuffer: false,
      },
    ];

    const display = resolveDisplayDayPlaces(stored, derived, "2026-12-07", "2026-12-11");
    const dec7 = display.find((d) => d.date === "2026-12-07");
    assert.equal(dec7?.secondaryCity, "Kagoshima");
    assert.equal(dec7?.primaryShare, DEFAULT_HALF_SHARE);
  });

  it("fills half-empty transition days between consecutive cities", () => {
    const stored = [
      {
        date: "2026-12-14",
        primaryCity: "Hiroshima",
        secondaryCity: null,
        primaryShare: 1,
        dayType: "trip" as const,
        includeBuffer: false,
      },
      {
        date: "2026-12-15",
        primaryCity: "Hiroshima",
        secondaryCity: null,
        primaryShare: DEFAULT_HALF_SHARE,
        dayType: "trip" as const,
        includeBuffer: false,
      },
      {
        date: "2026-12-16",
        primaryCity: "",
        secondaryCity: "Kyoto",
        primaryShare: DEFAULT_HALF_SHARE,
        dayType: "trip" as const,
        includeBuffer: false,
      },
      {
        date: "2026-12-17",
        primaryCity: "Kyoto",
        secondaryCity: "Tokyo",
        primaryShare: DEFAULT_HALF_SHARE,
        dayType: "trip" as const,
        includeBuffer: false,
      },
    ];
    const derived = stored.map((day) => ({ ...day }));

    const display = resolveDisplayDayPlaces(stored, derived, "2026-12-14", "2026-12-17");
    const dec15 = display.find((d) => d.date === "2026-12-15");
    const dec16 = display.find((d) => d.date === "2026-12-16");
    assert.equal(dec15?.primaryCity, "Hiroshima");
    assert.equal(dec15?.secondaryCity, "Kyoto");
    assert.equal(dec16?.primaryCity, "Hiroshima");
    assert.equal(dec16?.secondaryCity, "Kyoto");
  });

  it("fillIncompleteSplitDays connects checkout and check-in halves", () => {
    const filled = fillIncompleteSplitDays([
      {
        date: "2026-12-15",
        primaryCity: "Hiroshima",
        secondaryCity: null,
        primaryShare: DEFAULT_HALF_SHARE,
        dayType: "trip",
        includeBuffer: false,
      },
      {
        date: "2026-12-16",
        primaryCity: "",
        secondaryCity: "Kyoto",
        primaryShare: DEFAULT_HALF_SHARE,
        dayType: "trip",
        includeBuffer: false,
      },
    ]);
    assert.equal(filled[0]?.secondaryCity, "Kyoto");
    assert.equal(filled[1]?.primaryCity, "Hiroshima");
  });
});
