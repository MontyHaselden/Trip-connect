import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { DEFAULT_HALF_SHARE } from "@/lib/host/wizard/location-stays";

import { enforceContentHalfDayBoundaries } from "./enforce-content-half-days";

describe("enforceContentHalfDayBoundaries", () => {
  const trip = {
    startDate: "2026-12-05",
    endDate: "2026-12-22",
    departureCity: "Christchurch",
    returnCity: "Christchurch",
  };

  it("splits a wrongly full check-in day into an evening half", () => {
    const result = enforceContentHalfDayBoundaries(
      [
        {
          date: "2026-12-14",
          primaryCity: "Hiroshima",
          secondaryCity: null,
          primaryShare: 1,
          dayType: "trip",
          includeBuffer: false,
        },
      ],
      trip,
      [
        {
          id: "hiroshima-hotel",
          cityLabel: "Hiroshima",
          stayType: "hotel",
          name: "The Knot",
          url: null,
          address: null,
          phone: null,
          checkInDate: "2026-12-14",
          checkOutDate: "2026-12-15",
          notes: null,
          isHomestayGroup: false,
          multipleInCity: false,
        },
      ],
    );
    const dec14 = result.find((d) => d.date === "2026-12-14");
    assert.equal(dec14?.primaryCity, "");
    assert.equal(dec14?.secondaryCity, "Hiroshima");
    assert.equal(dec14?.primaryShare, DEFAULT_HALF_SHARE);
  });

  it("leaves home margin departure days full", () => {
    const result = enforceContentHalfDayBoundaries(
      [
        {
          date: "2026-12-05",
          primaryCity: "Christchurch",
          secondaryCity: null,
          primaryShare: 1,
          dayType: "trip",
          includeBuffer: false,
        },
      ],
      trip,
      [],
    );
    const dec5 = result.find((d) => d.date === "2026-12-05");
    assert.equal(dec5?.primaryCity, "Christchurch");
    assert.equal(dec5?.primaryShare, 1);
  });

  it("keeps the last night before checkout as a half day, not full", () => {
    const result = enforceContentHalfDayBoundaries(
      [
        {
          date: "2026-12-19",
          primaryCity: "Tokyo",
          secondaryCity: null,
          primaryShare: 1,
          dayType: "trip",
          includeBuffer: false,
        },
        {
          date: "2026-12-20",
          primaryCity: "Tokyo",
          secondaryCity: null,
          primaryShare: 1,
          dayType: "trip",
          includeBuffer: false,
        },
        {
          date: "2026-12-21",
          primaryCity: "Tokyo",
          secondaryCity: null,
          primaryShare: 1,
          dayType: "trip",
          includeBuffer: false,
        },
        {
          date: "2026-12-22",
          primaryCity: "Tokyo",
          secondaryCity: null,
          primaryShare: 1,
          dayType: "trip",
          includeBuffer: false,
        },
      ],
      trip,
      [],
    );
    const dec20 = result.find((d) => d.date === "2026-12-20");
    const dec22 = result.find((d) => d.date === "2026-12-22");
    assert.equal(dec20?.primaryShare, 1);
    assert.equal(dec22?.primaryCity, "Tokyo");
    assert.equal(dec22?.secondaryCity, null);
    assert.equal(dec22?.primaryShare, DEFAULT_HALF_SHARE);
  });

  it("keeps the last painted night before checkout on the left half, not an empty morning", () => {
    const result = enforceContentHalfDayBoundaries(
      [
        {
          date: "2026-12-11",
          primaryCity: "Kagoshima",
          secondaryCity: null,
          primaryShare: 1,
          dayType: "trip",
          includeBuffer: false,
        },
        {
          date: "2026-12-12",
          primaryCity: "Kagoshima",
          secondaryCity: null,
          primaryShare: 1,
          dayType: "trip",
          includeBuffer: false,
        },
      ],
      trip,
      [],
    );
    const dec12 = result.find((d) => d.date === "2026-12-12");
    assert.equal(dec12?.primaryCity, "Kagoshima");
    assert.equal(dec12?.secondaryCity, null);
    assert.equal(dec12?.primaryShare, DEFAULT_HALF_SHARE);
  });
});
