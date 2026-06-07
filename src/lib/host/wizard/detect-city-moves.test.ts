import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { detectCityMoves, syncIntercityLegs } from "@/lib/host/wizard/detect-city-moves";
import type { DayPlaceDraft } from "@/lib/host/wizard/types";

function day(date: string, patch: Partial<DayPlaceDraft>): DayPlaceDraft {
  return {
    date,
    primaryCity: "",
    secondaryCity: null,
    primaryShare: 1,
    dayType: "trip",
    includeBuffer: false,
    ...patch,
  };
}

describe("detectCityMoves", () => {
  it("creates one city change on a crossover day, not again the next morning", () => {
    const dayPlaces = [
      day("2026-06-10", { primaryCity: "Tokyo, Japan" }),
      day("2026-06-11", {
        primaryCity: "Tokyo, Japan",
        secondaryCity: "Osaka, Japan",
        primaryShare: 0.5,
        dayType: "travel",
      }),
      day("2026-06-12", { primaryCity: "Osaka, Japan" }),
    ];

    const moves = detectCityMoves(dayPlaces);
    assert.equal(moves.length, 1);
    assert.equal(moves[0]!.date, "2026-06-11");
    assert.equal(moves[0]!.fromCity, "Tokyo, Japan");
    assert.equal(moves[0]!.toCity, "Osaka, Japan");
  });

  it("syncs intercity legs in trip date order", () => {
    const dayPlaces = [
      day("2026-06-10", { primaryCity: "Tokyo, Japan" }),
      day("2026-06-11", {
        primaryCity: "Tokyo, Japan",
        secondaryCity: "Osaka, Japan",
        primaryShare: 0.5,
        dayType: "travel",
      }),
      day("2026-06-12", { primaryCity: "Osaka, Japan" }),
      day("2026-06-20", { primaryCity: "Osaka, Japan", primaryShare: 0.5 }),
    ];

    const legs = syncIntercityLegs(dayPlaces, [], {
      outboundLegs: [],
      returnLegs: [],
      trip: {
        startDate: "2026-06-10",
        endDate: "2026-06-20",
        departureCity: "Christchurch, New Zealand",
        returnCity: "Christchurch, New Zealand",
      },
    });

    const cityChanges = legs.filter((l) => (l.legKind ?? "city_change") === "city_change");
    assert.equal(cityChanges.length, 1);
    assert.equal(cityChanges[0]!.travelDate, "2026-06-11");
  });
});
