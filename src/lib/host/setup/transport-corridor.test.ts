import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { bangkokStay, patongStay } from "./calendar-fixtures";
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

  it("uses 40/20/40 corridor proportions", () => {
    assert.equal(TRANSPORT_CORRIDOR_LEFT_SHARE, 0.4);
    assert.equal(TRANSPORT_CORRIDOR_WIDTH, 0.2);
    assert.equal(TRANSPORT_CORRIDOR_RIGHT_START, 0.6);
  });

  it("shortens city names for transfer route labels", () => {
    assert.equal(transferCityCode("Christchurch"), "CHR");
    assert.equal(transferCityCode("Singapore"), "SIN");
    assert.equal(transferCityCode("Patong"), "PAT");
    assert.equal(transferCityCode("Bangkok"), "BAN");
  });
});
