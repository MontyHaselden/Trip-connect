import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  placeMatchesCalendarCity,
  staysAreAdjacentHandoff,
  staysOverlapNights,
  transportLegCityMismatch,
} from "./conflict-rules";

describe("staysOverlapNights", () => {
  it("allows checkout and check-in on the same handoff day", () => {
    assert.equal(
      staysOverlapNights("2026-08-23", "2026-08-31", "2026-08-31", "2026-09-04"),
      false,
    );
  });

  it("flags nights claimed by both stays", () => {
    assert.equal(
      staysOverlapNights("2026-08-28", "2026-08-31", "2026-08-30", "2026-09-02"),
      true,
    );
  });
});

describe("staysAreAdjacentHandoff", () => {
  it("allows checkout morning one day after the next check-in", () => {
    assert.equal(
      staysAreAdjacentHandoff(
        { checkInDate: "2026-08-23", checkOutDate: "2026-09-01", cityLabel: "Patong" },
        { checkInDate: "2026-08-31", checkOutDate: "2026-09-04", cityLabel: "Bangkok" },
        (s) => s.cityLabel ?? "",
      ),
      true,
    );
  });
});

describe("transportLegCityMismatch", () => {
  it("accepts connection hubs on multi-leg travel days", () => {
    const legs = [
      {
        fromCity: "Christchurch Airport (CHC), New Zealand",
        toCity: "Melbourne Airport (MEL), Australia",
      },
      {
        fromCity: "Melbourne Airport (MEL), Australia",
        toCity: "Phuket International Airport (HKT), Thailand",
      },
    ];
    const painted = ["Christchurch, New Zealand", "Patong, Thailand"];

    for (const leg of legs) {
      const result = transportLegCityMismatch({ leg, paintedCities: painted, legsOnDate: legs });
      assert.equal(result.fromMismatch, false, `from mismatch for ${leg.fromCity}`);
      assert.equal(result.toMismatch, false, `to mismatch for ${leg.toCity}`);
    }
  });

  it("matches airport labels to painted city names", () => {
    assert.equal(
      placeMatchesCalendarCity(
        "Christchurch Airport (CHC), New Zealand",
        "Christchurch, New Zealand",
      ),
      true,
    );
    assert.equal(
      placeMatchesCalendarCity("Phuket International Airport (HKT), Thailand", "Patong, Thailand"),
      true,
    );
  });
});
