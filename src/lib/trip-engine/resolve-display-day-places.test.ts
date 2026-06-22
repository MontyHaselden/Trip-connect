import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { DEFAULT_HALF_SHARE } from "@/lib/host/wizard/location-stays";

import { resolveDisplayDayPlaces } from "./resolve-display-day-places";

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
});
