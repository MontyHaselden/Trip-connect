import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { bangkokStay, patongStay } from "@/lib/host/setup/calendar-fixtures";
import {
  classifyFlightLeg,
  classifyImportedFlightChain,
  mergeClassifiedLegsIntoState,
} from "@/lib/host/setup/classify-flight-legs";
import type { TripSetupState } from "@/lib/host/setup/types";
import { newId } from "@/lib/host/wizard/types";

function baseState(overrides: Partial<TripSetupState> = {}): TripSetupState {
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
    ...overrides,
  };
}

describe("classifyFlightLeg", () => {
  it("classifies home departure as outbound", () => {
    const bucket = classifyFlightLeg(
      {
        id: newId(),
        transportType: "plane",
        bookingStatus: "not_booked",
        travelDate: "2026-08-19",
        arrivalDate: "2026-08-20",
        departureTime: null,
        arrivalTime: null,
        fromCity: "Christchurch Airport (CHC)",
        toCity: "Suvarnabhumi Airport (BKK)",
        fromStation: null,
        toStation: null,
        operator: null,
        referenceNumber: null,
        flightNumber: "JQ30",
        notes: null,
      },
      baseState(),
    );
    assert.equal(bucket, "outbound");
  });

  it("classifies late trip flight home as return", () => {
    const bucket = classifyFlightLeg(
      {
        id: newId(),
        transportType: "plane",
        bookingStatus: "not_booked",
        travelDate: "2026-09-10",
        arrivalDate: "2026-09-11",
        departureTime: null,
        arrivalTime: null,
        fromCity: "Suvarnabhumi Airport (BKK)",
        toCity: "Christchurch Airport (CHC)",
        fromStation: null,
        toStation: null,
        operator: null,
        referenceNumber: null,
        flightNumber: "JQ31",
        notes: null,
      },
      baseState(),
    );
    assert.equal(bucket, "return");
  });

  it("classifies home connection on first stay check-in as outbound", () => {
    const bucket = classifyFlightLeg(
      {
        id: newId(),
        transportType: "plane",
        bookingStatus: "not_booked",
        travelDate: "2026-08-20",
        arrivalDate: "2026-08-20",
        departureTime: "08:20",
        arrivalTime: "10:05",
        fromCity: "Christchurch Airport (CHC)",
        toCity: "Melbourne Airport (MEL)",
        fromStation: "CHC",
        toStation: "MEL",
        operator: "Jetstar",
        referenceNumber: null,
        flightNumber: "JQ172",
        notes: null,
      },
      baseState({ basics: { ...baseState().basics, startDate: "2026-09-01" } }),
    );
    assert.equal(bucket, "outbound");
  });
});

describe("classifyImportedFlightChain", () => {
  it("places a full chain in one bucket", () => {
    const legs = [
      {
        id: newId(),
        transportType: "plane" as const,
        bookingStatus: "not_booked" as const,
        travelDate: "2026-08-19",
        arrivalDate: "2026-08-20",
        departureTime: null,
        arrivalTime: null,
        fromCity: "Christchurch Airport (CHC)",
        toCity: "Melbourne Airport (MEL)",
        fromStation: null,
        toStation: null,
        operator: null,
        referenceNumber: null,
        flightNumber: "JQ1",
        notes: null,
      },
    ];
    const classified = classifyImportedFlightChain(legs, baseState());
    assert.equal(classified.outbound.length, 1);
    assert.equal(classified.return.length, 0);
    assert.equal(classified.intercity.length, 0);
  });
});

describe("mergeClassifiedLegsIntoState", () => {
  it("replaces stale legs with the same flight number", () => {
    const staleId = newId();
    const state = baseState({
      intercityLegs: [
        {
          id: staleId,
          transportType: "plane",
          bookingStatus: "not_booked",
          travelDate: "2026-09-01",
          arrivalDate: null,
          departureTime: "08:20",
          arrivalTime: "10:05",
          fromCity: "Christchurch Airport (CHC)",
          toCity: "Melbourne Airport (MEL)",
          fromStation: "CHC",
          toStation: "MEL",
          operator: "Jetstar",
          referenceNumber: null,
          flightNumber: "JQ172",
          notes: null,
          intercityFromCity: "Christchurch",
          intercityToCity: "Melbourne",
          originGroupId: "main",
        },
      ],
    });

    const freshId = newId();
    const merged = mergeClassifiedLegsIntoState(state, {
      outbound: [
        {
          id: freshId,
          transportType: "plane",
          bookingStatus: "not_booked",
          travelDate: "2026-08-20",
          arrivalDate: null,
          departureTime: "08:20",
          arrivalTime: "10:05",
          fromCity: "Christchurch Airport (CHC)",
          toCity: "Melbourne Airport (MEL)",
          fromStation: "CHC",
          toStation: "MEL",
          operator: "Jetstar",
          referenceNumber: null,
          flightNumber: "JQ172",
          notes: null,
        },
      ],
      return: [],
      intercity: [],
    });

    assert.equal(merged.intercityLegs.length, 0);
    assert.equal(merged.outboundLegs.length, 1);
    assert.equal(merged.outboundLegs[0]?.travelDate, "2026-08-20");
    assert.equal(merged.outboundLegs[0]?.id, freshId);
  });
});
