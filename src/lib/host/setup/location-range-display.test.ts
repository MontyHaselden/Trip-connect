import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { patongStay } from "@/lib/host/setup/calendar-fixtures";
import {
  formatLocationStayRange,
  locationRangesFromContent,
  locationRangesFromDays,
} from "./location-range-display";
import type { DayPlaceDraft } from "@/lib/host/wizard/types";

function day(date: string, primary: string, secondary: string | null = null): DayPlaceDraft {
  return {
    date,
    primaryCity: primary,
    secondaryCity: secondary,
    primaryShare: secondary ? 0.5 : 1,
    dayType: "trip",
    includeBuffer: false,
  };
}

describe("locationRangesFromDays", () => {
  it("collapses consecutive same-city days into one range", () => {
    const days = [
      day("2026-08-24", "Patong, Thailand"),
      day("2026-08-25", "Patong, Thailand"),
      day("2026-08-26", "Patong, Thailand"),
      day("2026-08-27", "Patong, Thailand"),
      day("2026-08-28", "Patong, Thailand"),
      day("2026-08-31", "Patong, Thailand"),
    ];
    const ranges = locationRangesFromDays({
      days,
      tripStart: "2026-08-23",
      tripEnd: "2026-08-31",
    });
    assert.equal(ranges.length, 1);
    assert.equal(ranges[0]?.startDate, "2026-08-24");
    assert.equal(ranges[0]?.endDate, "2026-08-31");
    assert.equal(formatLocationStayRange(ranges[0]!), "Patong · 24th – 31st Aug 2026");
  });

  it("includes post-trip home buffer after return departure", () => {
    const days = [
      day("2026-08-31", "Patong, Thailand", "Bangkok, Thailand"),
      day("2026-09-01", "Bangkok, Thailand"),
      day("2026-09-02", "Bangkok, Thailand"),
      day("2026-09-03", "Bangkok, Thailand"),
      day("2026-09-04", "Bangkok, Thailand", "Christchurch, New Zealand"),
    ];
    const ranges = locationRangesFromDays({
      days,
      tripStart: "2026-08-23",
      tripEnd: "2026-09-04",
      returnCity: "Christchurch, New Zealand",
      hasReturnTransport: true,
    });
    const home = ranges.find((range) => range.location.includes("Christchurch"));
    assert.ok(home);
    assert.equal(home?.startDate, "2026-09-04");
    assert.equal(home?.endDate, "2026-09-05");
    assert.equal(formatLocationStayRange(home!), "Christchurch · 4th – 5th Sep 2026");
  });
});

describe("locationRangesFromContent", () => {
  it("uses hotel band start instead of airport metro on arrival day", () => {
    const outbound = [
      {
        id: "jq17",
        transportType: "plane" as const,
        bookingStatus: "booked" as const,
        travelDate: "2026-08-23",
        arrivalDate: "2026-08-23",
        departureTime: "14:50",
        arrivalTime: "20:40",
        fromCity: "Melbourne Airport (MEL), Australia",
        toCity: "Phuket International Airport (HKT), Thailand",
        fromStation: null,
        toStation: null,
        operator: "Jetstar",
        referenceNumber: null,
        flightNumber: "JQ 17",
        notes: null,
      },
    ];
    const ranges = locationRangesFromContent({
      days: [
        day("2026-08-23", "Christchurch, New Zealand", "Phuket"),
        day("2026-08-24", "Patong, Thailand"),
      ],
      tripStart: "2026-08-23",
      tripEnd: "2026-08-31",
      accommodationStays: [patongStay({ checkInDate: "2026-08-23", checkOutDate: "2026-08-31" })],
      outboundLegs: outbound,
      returnLegs: [],
      intercityLegs: [],
    });
    const patong = ranges.find((range) => range.location === "Patong");
    assert.equal(patong?.startDate, "2026-08-24");
    assert.ok(!ranges.some((range) => range.location === "Phuket"));
  });

  it("merges duplicate Patong hotel ranges into one row", () => {
    const ranges = locationRangesFromContent({
      days: [day("2026-08-24", "Patong, Thailand")],
      tripStart: "2026-08-23",
      tripEnd: "2026-09-01",
      accommodationStays: [
        patongStay({ checkInDate: "2026-08-24", checkOutDate: "2026-09-01" }),
        patongStay({
          id: "patong-duplicate",
          checkInDate: "2026-08-24",
          checkOutDate: "2026-08-25",
        }),
      ],
      outboundLegs: [],
      returnLegs: [],
      intercityLegs: [],
    });
    const patong = ranges.filter((range) => range.location === "Patong");
    assert.equal(patong.length, 1);
    assert.equal(patong[0]?.startDate, "2026-08-24");
    assert.equal(patong[0]?.endDate, "2026-09-01");
  });
});
