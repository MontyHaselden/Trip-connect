import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { TRANSPORT_CORRIDOR_LEFT_SHARE } from "./transport-corridor";
import {
  dayConflictsWithLegCorridor,
  dayMatchesLegCorridor,
} from "./transport-leg-corridor";
import { syncTransportLegAllocation } from "./transport-allocation";
import type { TripSetupState } from "./types";

function baseState(): TripSetupState {
  return {
    basics: {
      name: "Japan",
      schoolName: "School",
      startDate: "2026-12-01",
      endDate: "2026-12-22",
      timezone: "Asia/Tokyo",
      departureCity: "Christchurch",
      returnCity: "Christchurch",
      defaultDepartureAirport: "",
      destinationCountries: ["Japan"],
    },
    mainGroupId: "main",
    groups: [
      { id: "main", name: "Main", type: "main", description: null, sortOrder: 0, isMain: true },
    ],
    dayPlacesByGroupId: {
      main: [
        {
          date: "2026-12-13",
          primaryCity: "Kagoshima",
          secondaryCity: null,
          primaryShare: 0.5,
          dayType: "trip",
          includeBuffer: false,
        },
      ],
    },
    outboundLegs: [],
    returnLegs: [],
    intercityLegs: [
      {
        id: "leg-tottori-hiroshima",
        legKind: "city_change",
        transportType: "train",
        bookingStatus: "not_booked",
        travelDate: "2026-12-13",
        departureTime: null,
        arrivalTime: null,
        fromCity: "Tottori",
        toCity: "Hiroshima",
        fromStation: null,
        toStation: null,
        operator: null,
        referenceNumber: null,
        flightNumber: null,
        notes: null,
        intercityFromCity: "Tottori",
        intercityToCity: "Hiroshima",
        originGroupId: "main",
        sourceEntityId: null,
      },
    ],
    accommodationStays: [],
    activities: [],
    overlayOps: [],
  };
}

describe("transport leg corridor", () => {
  it("detects conflict when painted city is not on the leg route", () => {
    const day = baseState().dayPlacesByGroupId.main![0]!;
    assert.equal(dayConflictsWithLegCorridor(day, "Tottori", "Hiroshima"), true);
    assert.equal(dayMatchesLegCorridor(day, "Tottori", "Hiroshima"), false);
  });

  it("matches a travel corridor split day", () => {
    const day = {
      date: "2026-12-13",
      primaryCity: "Tottori",
      secondaryCity: "Hiroshima",
      primaryShare: TRANSPORT_CORRIDOR_LEFT_SHARE,
      dayType: "travel" as const,
      includeBuffer: false,
    };
    assert.equal(dayMatchesLegCorridor(day, "Tottori", "Hiroshima"), true);
    assert.equal(dayConflictsWithLegCorridor(day, "Tottori", "Hiroshima"), false);
  });
});

describe("syncTransportLegAllocation", () => {
  it("unallocates a leg when location paint conflicts and does not re-paint it", () => {
    const next = syncTransportLegAllocation(baseState(), "main", { checkConflicts: true });
    assert.equal(next.intercityLegs[0]?.surfaceOnly, true);
    const dec13 = next.dayPlacesByGroupId.main?.find((d) => d.date === "2026-12-13");
    assert.equal(dec13?.primaryCity, "Kagoshima");
    assert.ok(!dec13?.secondaryCity?.toLowerCase().includes("hiroshima"));
  });

  it("auto-allocates when days are painted to match the leg corridor", () => {
    const state = baseState();
    state.intercityLegs[0] = { ...state.intercityLegs[0]!, surfaceOnly: true };
    state.dayPlacesByGroupId.main = [
      {
        date: "2026-12-13",
        primaryCity: "Tottori",
        secondaryCity: "Hiroshima",
        primaryShare: TRANSPORT_CORRIDOR_LEFT_SHARE,
        dayType: "travel",
        includeBuffer: false,
      },
    ];
    const next = syncTransportLegAllocation(state, "main", { checkConflicts: true });
    assert.equal(next.intercityLegs[0]?.surfaceOnly, false);
  });
});
