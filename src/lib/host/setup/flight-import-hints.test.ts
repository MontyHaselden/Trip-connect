import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { bangkokStay, patongStay } from "@/lib/host/setup/calendar-fixtures";
import {
  flightImportHintCandidates,
  scoreFlightChainForTrip,
} from "@/lib/host/setup/flight-import-hints";
import type { TripSetupState } from "@/lib/host/setup/types";

function baseState(): TripSetupState {
  return {
    basics: {
      name: "Test",
      startDate: "2026-08-20",
      endDate: "2026-09-10",
      timezone: "Pacific/Auckland",
      departureCity: "Christchurch",
      returnCity: "Christchurch",
      defaultDepartureAirport: "Christchurch Airport (CHC)",
      destinationCountries: ["Thailand"],
    },
    mainGroupId: "main",
    groups: [{ id: "main", name: "Main Group", type: "main", isMain: true }],
    dayPlacesByGroupId: { main: [] },
    outboundLegs: [],
    returnLegs: [],
    intercityLegs: [],
    accommodationStays: [patongStay(), bangkokStay()],
    activities: [],
    overlayOps: [],
  };
}

describe("flightImportHintCandidates", () => {
  it("prefers last stay checkout before trip start", () => {
    const hints = flightImportHintCandidates(baseState());
    assert.equal(hints[0], "2026-08-20");
    assert.ok(hints.includes("2026-09-05"));
  });
});

describe("scoreFlightChainForTrip", () => {
  it("prefers september return chain over august overlap", () => {
    const returnChain = [
      {
        flightNumber: "JQ30",
        travelDate: "2026-09-04",
        arrivalDate: "2026-09-05",
      },
      {
        flightNumber: "JQ171",
        travelDate: "2026-09-05",
        arrivalDate: null,
      },
    ];
    const augustChain = [
      {
        flightNumber: "JQ30",
        travelDate: "2026-08-21",
        arrivalDate: "2026-08-22",
      },
      {
        flightNumber: "JQ171",
        travelDate: "2026-08-22",
        arrivalDate: null,
      },
    ];

    const returnScore = scoreFlightChainForTrip(returnChain, baseState());
    const augustScore = scoreFlightChainForTrip(augustChain, baseState());
    assert.ok(returnScore > augustScore);
  });

  it("prefers home-airport outbound connection near trip start over post-stay slot", () => {
    const outboundConnection = [
      {
        flightNumber: "JQ172",
        travelDate: "2026-08-23",
        arrivalDate: "2026-08-23",
        departureIata: "CHC",
        arrivalIata: "MEL",
      },
    ];
    const checkoutSlot = [
      {
        flightNumber: "JQ172",
        travelDate: "2026-09-01",
        arrivalDate: "2026-09-01",
        departureIata: "CHC",
        arrivalIata: "MEL",
      },
    ];
    const checkoutDay = [
      {
        flightNumber: "JQ172",
        travelDate: "2026-09-05",
        arrivalDate: "2026-09-05",
        departureIata: "CHC",
        arrivalIata: "MEL",
      },
    ];

    const bookedScore = scoreFlightChainForTrip(outboundConnection, baseState());
    const slotScore = scoreFlightChainForTrip(checkoutSlot, baseState());
    const checkoutScore = scoreFlightChainForTrip(checkoutDay, baseState());
    assert.ok(bookedScore > slotScore);
    assert.ok(bookedScore > checkoutScore);
  });
});
