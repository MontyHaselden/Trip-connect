import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { DEFAULT_HALF_SHARE } from "@/lib/host/wizard/location-stays";

import { inferDayPlacesFromStay } from "./setup-inference";

describe("inferDayPlacesFromStay", () => {
  it("paints each night as evening half plus next-day morning half", () => {
    const result = inferDayPlacesFromStay([], {
      cityLabel: "Chang Wat",
      checkInDate: "2026-08-22",
      checkOutDate: "2026-09-02",
    });

    const aug22 = result.find((d) => d.date === "2026-08-22");
    const aug23 = result.find((d) => d.date === "2026-08-23");
    const sep1 = result.find((d) => d.date === "2026-09-01");
    const sep2 = result.find((d) => d.date === "2026-09-02");

    assert.equal(aug22?.primaryCity, "");
    assert.equal(aug22?.secondaryCity, "Chang Wat");
    assert.equal(aug22?.primaryShare, DEFAULT_HALF_SHARE);
    assert.equal(aug23?.primaryCity, "Chang Wat");
    assert.equal(aug23?.primaryShare, 1);
    assert.equal(sep1?.primaryCity, "Chang Wat");
    assert.equal(sep1?.primaryShare, 1);
    assert.equal(sep2?.primaryCity, "Chang Wat");
    assert.equal(sep2?.primaryShare, DEFAULT_HALF_SHARE);
  });

  it("splits a single-night stay across two half days", () => {
    const result = inferDayPlacesFromStay([], {
      cityLabel: "Tokyo",
      checkInDate: "2026-08-22",
      checkOutDate: "2026-08-23",
    });
    const night = result.find((d) => d.date === "2026-08-22");
    const morning = result.find((d) => d.date === "2026-08-23");
    assert.equal(night?.primaryCity, "");
    assert.equal(night?.secondaryCity, "Tokyo");
    assert.equal(night?.primaryShare, DEFAULT_HALF_SHARE);
    assert.equal(morning?.primaryCity, "Tokyo");
    assert.equal(morning?.primaryShare, DEFAULT_HALF_SHARE);
  });

  it("replaces an existing stay city when the accommodation changes", () => {
    const existing = inferDayPlacesFromStay([], {
      cityLabel: "Chang Wat",
      checkInDate: "2026-08-22",
      checkOutDate: "2026-09-02",
    });

    const result = inferDayPlacesFromStay(
      existing,
      {
        cityLabel: "Minato City, Tokyo",
        checkInDate: "2026-08-22",
        checkOutDate: "2026-09-02",
      },
      { replaceExisting: true },
    );

    const aug23 = result.find((d) => d.date === "2026-08-23");
    const sep1 = result.find((d) => d.date === "2026-09-01");
    const sep2 = result.find((d) => d.date === "2026-09-02");
    assert.equal(aug23?.primaryCity, "Minato City, Tokyo");
    assert.equal(sep1?.primaryCity, "Minato City, Tokyo");
    assert.equal(sep2?.primaryCity, "Minato City, Tokyo");
  });

  it("fills the empty half when another city already occupies part of the day", () => {
    const result = inferDayPlacesFromStay(
      [
        {
          date: "2026-08-22",
          primaryCity: "Bangkok",
          secondaryCity: null,
          primaryShare: DEFAULT_HALF_SHARE,
          dayType: "trip",
          includeBuffer: false,
        },
      ],
      {
        cityLabel: "Chang Wat",
        checkInDate: "2026-08-22",
        checkOutDate: "2026-08-24",
      },
    );
    const aug22 = result.find((d) => d.date === "2026-08-22");
    assert.equal(aug22?.primaryCity, "Bangkok");
    assert.equal(aug22?.secondaryCity, "Chang Wat");
    assert.equal(aug22?.primaryShare, DEFAULT_HALF_SHARE);
  });

  it("keeps an existing half-day city when adding a new stay on the empty half", () => {
    const result = inferDayPlacesFromStay(
      [
        {
          date: "2026-08-31",
          primaryCity: "Patong",
          secondaryCity: null,
          primaryShare: DEFAULT_HALF_SHARE,
          dayType: "trip",
          includeBuffer: false,
        },
      ],
      {
        cityLabel: "Bangkok",
        checkInDate: "2026-08-31",
        checkOutDate: "2026-09-04",
      },
    );
    const aug31 = result.find((d) => d.date === "2026-08-31");
    assert.equal(aug31?.primaryCity, "Patong");
    assert.equal(aug31?.secondaryCity, "Bangkok");
    assert.equal(aug31?.primaryShare, DEFAULT_HALF_SHARE);
  });

  it("paints the last booked night as evening today and morning tomorrow", () => {
    const result = inferDayPlacesFromStay([], {
      cityLabel: "Bangkok",
      checkInDate: "2026-09-01",
      checkOutDate: "2026-09-05",
    });

    const sep4 = result.find((d) => d.date === "2026-09-04");
    const sep5 = result.find((d) => d.date === "2026-09-05");

    assert.equal(sep4?.primaryCity, "Bangkok");
    assert.equal(sep4?.primaryShare, 1);
    assert.equal(sep5?.primaryCity, "Bangkok");
    assert.equal(sep5?.primaryShare, DEFAULT_HALF_SHARE);
  });
});
