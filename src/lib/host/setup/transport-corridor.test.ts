import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { bangkokStay, patongStay } from "./calendar-fixtures";
import {
  computeTransitOverlays,
  computeTravelDayLayouts,
} from "@/lib/host/wizard/transport-day-placement";
import {
  isAccommodationCrossoverDay,
  transferCityCode,
  TRANSPORT_CORRIDOR_LEFT_SHARE,
  TRANSPORT_CORRIDOR_RIGHT_START,
  TRANSPORT_CORRIDOR_WIDTH,
} from "./transport-corridor";
import type { DayPlaceDraft } from "@/lib/host/wizard/types";

const trip = {
  startDate: "2026-08-23",
  endDate: "2026-09-01",
  departureCity: "London",
  returnCity: "London",
};

describe("transport-corridor", () => {
  it("detects accommodation crossover days", () => {
    const day: DayPlaceDraft = {
      date: "2026-08-31",
      primaryCity: "Patong",
      secondaryCity: "Bangkok",
      primaryShare: TRANSPORT_CORRIDOR_LEFT_SHARE,
      dayType: "travel",
      includeBuffer: false,
    };
    const acco = new Map([
      ["2026-08-30", "Royal Paradise"],
      ["2026-08-31", "Royal Paradise"],
      ["2026-09-01", "Centre Point"],
    ]);
    assert.equal(isAccommodationCrossoverDay(day, acco, trip), true);
  });

  it("does not treat next-day check-in as arrival on the crossover date", () => {
    const day: DayPlaceDraft = {
      date: "2026-08-31",
      primaryCity: "Patong",
      secondaryCity: "Bangkok",
      primaryShare: TRANSPORT_CORRIDOR_LEFT_SHARE,
      dayType: "travel",
      includeBuffer: false,
    };
    const acco = new Map([
      ["2026-08-30", "Royal Paradise"],
      ["2026-09-01", "Centre Point"],
    ]);
    const stays = [patongStay({ checkOutDate: "2026-08-31" }), bangkokStay()];
    assert.equal(isAccommodationCrossoverDay(day, acco, trip, stays), false);
  });

  it("uses half-day split with overlay-only corridor (no middle band)", () => {
    assert.equal(TRANSPORT_CORRIDOR_LEFT_SHARE, 0.5);
    assert.equal(TRANSPORT_CORRIDOR_WIDTH, 0);
    assert.equal(TRANSPORT_CORRIDOR_RIGHT_START, 0.5);
  });

  it("keeps intercity crossover days on location paint with a transit overlay", () => {
    const day: DayPlaceDraft = {
      date: "2026-12-13",
      primaryCity: "Kagoshima",
      secondaryCity: "Hiroshima",
      primaryShare: TRANSPORT_CORRIDOR_LEFT_SHARE,
      dayType: "trip",
      includeBuffer: false,
    };
    const draft = {
      outboundLegs: [],
      returnLegs: [],
      intercityLegs: [
        {
          id: "ic-kagoshima-hiroshima",
          fromCity: "Kagoshima",
          toCity: "Hiroshima",
          intercityFromCity: "Kagoshima",
          intercityToCity: "Hiroshima",
          travelDate: "2026-12-13",
          transportType: "train" as const,
          bookingStatus: "not_booked" as const,
          departureTime: "09:00",
          arrivalTime: "12:00",
          fromStation: null,
          toStation: null,
          carrier: null,
          flightNumber: null,
          notes: null,
        },
      ],
      dayPlaces: [day],
    };
    const japanTrip = {
      startDate: "2026-12-05",
      endDate: "2026-12-21",
      departureCity: "Christchurch",
      returnCity: "Christchurch",
    };
    const layouts = computeTravelDayLayouts(draft, japanTrip);
    const overlays = computeTransitOverlays(draft, japanTrip);
    assert.equal(layouts.has("2026-12-13"), false);
    assert.equal(overlays.has("2026-12-13"), false);
  });

  it("shortens city names for transfer route labels", () => {
    assert.equal(transferCityCode("Christchurch"), "CHR");
    assert.equal(transferCityCode("Singapore"), "SIN");
    assert.equal(transferCityCode("Patong"), "PAT");
    assert.equal(transferCityCode("Bangkok"), "BAN");
  });
});
