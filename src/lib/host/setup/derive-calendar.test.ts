import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  assertCalendarInvariant,
  deriveCalendarState,
} from "./derive-calendar";
import {
  bangkokStay,
  patongBangkokLeg,
  patongBangkokTrip,
  patongStay,
} from "./calendar-fixtures";

describe("deriveCalendarState", () => {
  it("paints patong and bangkok stays with aligned accommodation bands", () => {
    const state = deriveCalendarState({
      stays: [patongStay(), bangkokStay()],
      intercityLegs: [patongBangkokLeg()],
      trip: patongBangkokTrip,
      transportDraft: {
        outboundLegs: [],
        returnLegs: [],
        intercityLegs: [patongBangkokLeg()],
        dayPlaces: [],
      },
      gridStart: "2026-08-20",
      gridEnd: "2026-09-10",
    });

    assert.equal(state.accommodationByDate.get("2026-08-24"), "Royal Paradise Hotel");
    assert.equal(state.accommodationByDate.get("2026-09-02"), "Centre Point Plus");
    assert.equal(assertCalendarInvariant(state).length, 0);

    const aug31 = state.dayPlaces.find((d) => d.date === "2026-08-31");
    assert.ok(aug31?.primaryCity.includes("Patong") || aug31?.primaryCity === "Patong");
    assert.ok(aug31?.secondaryCity?.includes("Bangkok") || aug31?.secondaryCity === "Bangkok");

    const sep4 = state.dayPlaces.find((d) => d.date === "2026-09-04");
    const sep5 = state.dayPlaces.find((d) => d.date === "2026-09-05");
    assert.equal(sep4?.primaryCity, "Bangkok");
    assert.equal(sep4?.primaryShare, 1);
    assert.equal(sep5?.primaryCity, "Bangkok");
    assert.equal(sep5?.primaryShare, 0.5);
    assert.equal(state.accommodationByDate.get("2026-09-04"), "Centre Point Plus");
  });

  it("paints post-trip home buffer on the day after return departure", () => {
    const trip = {
      startDate: "2026-08-23",
      endDate: "2026-09-04",
      departureCity: "Christchurch, New Zealand",
      returnCity: "Christchurch, New Zealand",
    };
    const state = deriveCalendarState({
      stays: [patongStay(), bangkokStay({ checkOutDate: "2026-09-05" })],
      intercityLegs: [],
      trip,
      transportDraft: {
        outboundLegs: [],
        returnLegs: [
          {
            id: "return-1",
            transportType: "plane",
            bookingStatus: "not_booked",
            travelDate: "2026-09-04",
            arrivalDate: "2026-09-04",
            departureTime: "10:00",
            arrivalTime: "22:00",
            fromCity: "Bangkok",
            toCity: "Christchurch Airport (CHC), New Zealand",
            fromStation: null,
            toStation: null,
            operator: null,
            referenceNumber: null,
            flightNumber: null,
            notes: null,
          },
        ],
        intercityLegs: [],
        dayPlaces: [],
      },
      gridStart: "2026-08-20",
      gridEnd: "2026-09-10",
    });

    const sep5 = state.dayPlaces.find((d) => d.date === "2026-09-05");
    assert.equal(sep5?.dayType, "buffer");
    assert.ok(sep5?.primaryCity.includes("Christchurch"));
    assert.equal(sep5?.primaryShare, 1);
  });

  it("clears orphan Christchurch days after return flights are removed", () => {
    const trip = {
      startDate: "2026-08-23",
      endDate: "2026-09-04",
      departureCity: "Christchurch, New Zealand",
      returnCity: "Christchurch, New Zealand",
    };
    const state = deriveCalendarState({
      stays: [patongStay(), bangkokStay({ checkOutDate: "2026-09-05" })],
      intercityLegs: [patongBangkokLeg()],
      trip,
      transportDraft: {
        outboundLegs: [],
        returnLegs: [],
        intercityLegs: [patongBangkokLeg()],
        dayPlaces: [
          {
            date: "2026-09-05",
            primaryCity: "Christchurch, New Zealand",
            secondaryCity: null,
            primaryShare: 1,
            dayType: "buffer",
            includeBuffer: false,
          },
          {
            date: "2026-09-06",
            primaryCity: "Christchurch, New Zealand",
            secondaryCity: null,
            primaryShare: 1,
            dayType: "buffer",
            includeBuffer: false,
          },
        ],
      },
      gridStart: "2026-08-20",
      gridEnd: "2026-09-10",
    });

    const sep4 = state.dayPlaces.find((d) => d.date === "2026-09-04");
    const sep5 = state.dayPlaces.find((d) => d.date === "2026-09-05");
    const sep6 = state.dayPlaces.find((d) => d.date === "2026-09-06");

    assert.equal(sep4?.primaryCity, "Bangkok");
    assert.equal(sep4?.secondaryCity, null);
    assert.ok(!sep5?.primaryCity.includes("Christchurch"));
    assert.equal(sep6?.primaryCity, "");
  });
});
