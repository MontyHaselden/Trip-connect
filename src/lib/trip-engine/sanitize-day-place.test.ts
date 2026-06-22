import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { DEFAULT_HALF_SHARE } from "@/lib/host/wizard/location-stays";

import { repairCorruptDayPlace, repairMisplacedSecondaryHalfDay } from "./sanitize-day-place";

describe("repairMisplacedSecondaryHalfDay", () => {
  it("moves a corrupted departure half from right back to left", () => {
    const repaired = repairMisplacedSecondaryHalfDay(
      {
        date: "2026-12-12",
        primaryCity: "",
        secondaryCity: "Kagoshima",
        primaryShare: DEFAULT_HALF_SHARE,
        dayType: "trip",
        includeBuffer: false,
      },
      [],
    );
    assert.equal(repaired.primaryCity, "Kagoshima");
    assert.equal(repaired.secondaryCity, null);
    assert.equal(repaired.primaryShare, DEFAULT_HALF_SHARE);
  });

  it("keeps valid check-in afternoon halves", () => {
    const day = {
      date: "2026-12-13",
      primaryCity: "",
      secondaryCity: "Hiroshima",
      primaryShare: DEFAULT_HALF_SHARE,
      dayType: "trip" as const,
      includeBuffer: false,
    };
    const repaired = repairMisplacedSecondaryHalfDay(day, [
      {
        id: "hiroshima",
        cityLabel: "Hiroshima",
        stayType: "hotel",
        name: "The Knot",
        url: null,
        address: null,
        phone: null,
        checkInDate: "2026-12-13",
        checkOutDate: "2026-12-15",
        notes: null,
        isHomestayGroup: false,
        multipleInCity: false,
      },
    ]);
    assert.deepEqual(repaired, day);
  });

  it("collapses duplicate city on both halves to a full day", () => {
    const repaired = repairCorruptDayPlace(
      {
        date: "2026-12-12",
        primaryCity: "Kagoshima",
        secondaryCity: "Kagoshima",
        primaryShare: DEFAULT_HALF_SHARE,
        dayType: "trip",
        includeBuffer: false,
      },
      [],
    );
    assert.equal(repaired.primaryCity, "Kagoshima");
    assert.equal(repaired.secondaryCity, null);
    assert.equal(repaired.primaryShare, 1);
  });
});
