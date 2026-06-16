import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  ensurePostTripHomeBuffer,
  ensurePreTripHomeBuffer,
  postTripHomeBufferDate,
  preTripHomeBufferDate,
} from "./home-locks";

const trip = {
  startDate: "2026-08-23",
  endDate: "2026-09-04",
  departureCity: "Christchurch, New Zealand",
  returnCity: "Christchurch, New Zealand",
};

describe("home buffer dates", () => {
  it("resolves pre- and post-trip buffer dates", () => {
    assert.equal(preTripHomeBufferDate(trip.startDate), "2026-08-22");
    assert.equal(postTripHomeBufferDate(trip.endDate), "2026-09-05");
    assert.equal(postTripHomeBufferDate(trip.endDate, "2026-09-05"), "2026-09-06");
  });
});

describe("ensurePreTripHomeBuffer", () => {
  it("paints departure city on the day before trip start", () => {
    const days = ensurePreTripHomeBuffer(
      [
        {
          date: "2026-08-23",
          primaryCity: "Christchurch, New Zealand",
          secondaryCity: "Patong",
          primaryShare: 0.25,
          dayType: "travel",
          includeBuffer: false,
        },
      ],
      trip,
    );

    const home = days.find((d) => d.date === "2026-08-22");
    assert.equal(home?.dayType, "buffer");
    assert.ok(home?.primaryCity.includes("Christchurch"));
    assert.equal(home?.primaryShare, 1);
  });
});

describe("ensurePostTripHomeBuffer", () => {
  it("paints return city on the day after trip end when arrival is same day", () => {
    const days = ensurePostTripHomeBuffer(
      [
        {
          date: "2026-09-04",
          primaryCity: "Bangkok",
          secondaryCity: "Christchurch, New Zealand",
          primaryShare: 0.5,
          dayType: "return",
          includeBuffer: false,
        },
      ],
      trip,
    );

    const home = days.find((d) => d.date === "2026-09-05");
    assert.equal(home?.dayType, "buffer");
    assert.ok(home?.primaryCity.includes("Christchurch"));
    assert.equal(home?.primaryShare, 1);
  });

  it("paints return city the day after home arrival when landing follows trip end", () => {
    const days = ensurePostTripHomeBuffer(
      [
        {
          date: "2026-09-05",
          primaryCity: "",
          secondaryCity: "Christchurch, New Zealand",
          primaryShare: 0.5,
          dayType: "travel",
          includeBuffer: false,
        },
      ],
      trip,
      true,
      "2026-09-05",
    );

    const home = days.find((d) => d.date === "2026-09-06");
    assert.equal(home?.dayType, "buffer");
    assert.ok(home?.primaryCity.includes("Christchurch"));
    assert.equal(home?.primaryShare, 1);
    assert.equal(days.find((d) => d.date === "2026-09-05")?.dayType, "travel");
  });
});
