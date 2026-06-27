import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { setupStateToGraph } from "./adapters";
import { repairTransportGraphSync } from "./repair-transport-graph";
import type { TripSetupState } from "@/lib/host/setup/types";

function baseState(): TripSetupState {
  return {
    basics: {
      name: "Japan",
      schoolName: "",
      startDate: "2026-12-05",
      endDate: "2026-12-21",
      timezone: "Asia/Tokyo",
      departureCity: "Christchurch",
      returnCity: "Christchurch",
      defaultDepartureAirport: "",
      destinationCountries: ["Japan"],
    },
    mainGroupId: "main",
    groups: [
      {
        id: "main",
        name: "Main",
        type: "main",
        description: null,
        sortOrder: 0,
        isMain: true,
      },
    ],
    dayPlacesByGroupId: { main: [] },
    outboundLegs: [
      {
        id: "out-1",
        transportType: "plane",
        bookingStatus: "not_booked",
        travelDate: "2026-12-05",
        arrivalDate: "2026-12-05",
        departureTime: null,
        arrivalTime: null,
        fromCity: "Christchurch",
        toCity: "Tokyo",
        fromStation: null,
        toStation: null,
        operator: null,
        referenceNumber: null,
        flightNumber: "NZ99",
        notes: null,
      },
    ],
    returnLegs: [
      {
        id: "ret-1",
        transportType: "plane",
        bookingStatus: "not_booked",
        travelDate: "2026-12-21",
        arrivalDate: "2026-12-21",
        departureTime: null,
        arrivalTime: null,
        fromCity: "Tokyo",
        toCity: "Christchurch",
        fromStation: null,
        toStation: null,
        operator: null,
        referenceNumber: null,
        flightNumber: "NZ100",
        notes: null,
      },
    ],
    intercityLegs: [],
    accommodationStays: [],
    transportProducts: [
      {
        id: "prod-dup-b",
        kind: "flight_package",
        name: "CHC to Tokyo return",
        participantIds: [],
        notes: null,
      },
      {
        id: "prod-dup-a",
        kind: "flight_package",
        name: "CHC to Tokyo return",
        participantIds: [],
        notes: null,
      },
    ],
    activities: [],
    overlayOps: [],
  };
}

describe("repairTransportGraphSync", () => {
  it("dedupes transport products and links orphan flight packages", () => {
    const graph = repairTransportGraphSync(setupStateToGraph("trip-1", baseState()));
    assert.equal(graph.transportProducts?.length, 1);
    assert.equal(graph.outboundLegs[0]?.transportProductId, graph.transportProducts?.[0]?.id);
    assert.equal(graph.returnLegs[0]?.transportProductId, graph.transportProducts?.[0]?.id);
  });

  it("moves mis-bucketed return package legs out of outbound", () => {
    const state = baseState();
    const productId = state.transportProducts![0]!.id;
    const returnLeg = {
      id: "ret-1",
      transportType: "plane" as const,
      bookingStatus: "not_booked" as const,
      travelDate: "2026-12-21",
      arrivalDate: "2026-12-21",
      departureTime: null,
      arrivalTime: null,
      fromCity: "Tokyo",
      toCity: "Christchurch",
      fromStation: null,
      toStation: null,
      operator: null,
      referenceNumber: null,
      flightNumber: "NZ100",
      notes: null,
    };
    state.returnLegs = [];
    state.outboundLegs = [
      { ...state.outboundLegs[0]!, transportProductId: productId },
      { ...returnLeg, transportProductId: productId },
    ];

    const graph = repairTransportGraphSync(setupStateToGraph("trip-1", state));
    assert.equal(graph.outboundLegs.length, 1);
    assert.equal(graph.returnLegs.length, 1);
    assert.equal(graph.outboundLegs[0]?.fromCity, "Christchurch");
    assert.equal(graph.returnLegs[0]?.fromCity, "Tokyo");
  });

  it("unlinks misassigned products and repairs reversed leg dates", () => {
    const state = baseState();
    const productId = state.transportProducts![0]!.id;
    state.intercityLegs = [
      {
        id: "ic-1",
        legKind: "city_change",
        transportType: "train",
        bookingStatus: "not_booked",
        travelDate: "2026-12-17",
        arrivalDate: "2026-12-06",
        departureTime: null,
        arrivalTime: null,
        fromCity: "Tokyo",
        toCity: "Tottori",
        fromStation: null,
        toStation: null,
        operator: null,
        referenceNumber: null,
        flightNumber: null,
        notes: null,
        intercityFromCity: "Tokyo",
        intercityToCity: "Tottori",
        transportProductId: productId,
        originGroupId: "g-amanda",
      },
    ];
    state.transportProducts = [
      ...(state.transportProducts ?? []),
      {
        id: "prod-jr",
        kind: "rail_pass",
        name: "JR Pass",
        participantIds: [],
        notes: null,
      },
    ];

    const graph = repairTransportGraphSync(setupStateToGraph("trip-1", state));
    const leg = graph.intercityLegs[0]!;
    assert.equal(leg.transportProductId, null);
    assert.equal(leg.travelDate, "2026-12-06");
    assert.equal(leg.arrivalDate, "2026-12-17");
  });
});
