import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isCalendarDayInteractive } from "./transport-day-placement";

const trip = {
  startDate: "2026-08-23",
  endDate: "2026-09-04",
  departureCity: "Christchurch, New Zealand",
  returnCity: "Christchurch, New Zealand",
};

describe("isCalendarDayInteractive", () => {
  it("allows travel crossover days with full-day flight layout", () => {
    assert.equal(
      isCalendarDayInteractive({
        iso: "2026-08-23",
        trip,
        day: {
          primaryCity: "Christchurch, New Zealand",
          secondaryCity: "Patong, Thailand",
          primaryShare: 0.4,
          dayType: "travel",
        },
        travelSegments: [
          { kind: "city", city: "Christchurch", start: 0, end: 0.4 },
          { kind: "transit", label: "CHC → MEL → HKT", start: 0.4, end: 0.6 },
          { kind: "city", city: "Patong", start: 0.6, end: 1 },
        ],
      }),
      true,
    );
  });

  it("allows split return departure days", () => {
    assert.equal(
      isCalendarDayInteractive({
        iso: "2026-09-04",
        trip,
        day: {
          primaryCity: "Bangkok",
          secondaryCity: "Christchurch, New Zealand",
          primaryShare: 0.5,
          dayType: "return",
        },
      }),
      true,
    );
  });

  it("allows the post-trip home buffer day", () => {
    assert.equal(
      isCalendarDayInteractive({
        iso: "2026-09-05",
        trip,
        day: {
          primaryCity: "Christchurch, New Zealand",
          secondaryCity: null,
          primaryShare: 1,
          dayType: "buffer",
        },
      }),
      true,
    );
  });
});
