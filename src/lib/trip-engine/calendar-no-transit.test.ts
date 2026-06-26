import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { setupStateToGraph } from "./adapters";
import { buildCalendarRenderModel } from "./calendar-render-model";
import { applyCommands } from "./apply-commands";
import type { TripSetupState } from "@/lib/host/setup/types";
import { newId } from "@/lib/host/wizard/types";
import { computeCalendarTransport } from "@/lib/host/wizard/transport-day-placement";

function baseState(): TripSetupState {
  return {
    basics: {
      name: "Trip",
      schoolName: "",
      startDate: "2026-12-04",
      endDate: "2026-12-22",
      timezone: "Asia/Tokyo",
      departureCity: "Christchurch, New Zealand",
      returnCity: "Christchurch, New Zealand",
      defaultDepartureAirport: "",
      destinationCountries: ["Japan"],
    },
    mainGroupId: "g1",
    groups: [{ id: "g1", name: "Main", type: "main", description: null, sortOrder: 0, isMain: true }],
    dayPlacesByGroupId: {
      g1: [
        {
          date: "2026-12-17",
          primaryCity: "Tokyo, Japan",
          secondaryCity: null,
          primaryShare: 1,
          dayType: "trip",
          includeBuffer: false,
        },
      ],
    },
    outboundLegs: [],
    returnLegs: [],
    intercityLegs: [
      {
        id: newId(),
        transportType: "plane",
        bookingStatus: "booked",
        travelDate: "2026-12-17",
        arrivalDate: "2026-12-17",
        departureTime: "10:00",
        arrivalTime: "14:00",
        fromCity: "Tokyo, Japan",
        toCity: "Kagoshima, Japan",
        fromStation: "NRT",
        toStation: "KAG",
        operator: null,
        referenceNumber: null,
        flightNumber: "JL123",
        notes: null,
        intercityFromCity: "Tokyo, Japan",
        intercityToCity: "Kagoshima, Japan",
      },
    ],
    accommodationStays: [],
    activities: [],
    overlayOps: [],
  };
}

describe("calendar never renders transport", () => {
  it("render model has no transit layout fields", () => {
    const graph = setupStateToGraph("t1", baseState());
    const model = buildCalendarRenderModel(graph);
    assert.ok(!("travelLayoutsByDate" in model));
    assert.ok(!("transitByDate" in model));
    const dec17 = model.days.find((d) => d.date === "2026-12-17");
    assert.ok(dec17?.primaryCity.includes("Tokyo"));
  });

  it("computeCalendarTransport returns empty maps (no calendar bands)", () => {
    const state = baseState();
    const graph = setupStateToGraph("t1", state);
    const { travelLayouts, transitOverlays } = computeCalendarTransport(
      {
        outboundLegs: graph.outboundLegs,
        returnLegs: graph.returnLegs,
        intercityLegs: graph.intercityLegs,
        dayPlaces: graph.dayPlacesByGroupId.g1 ?? [],
      },
      {
        startDate: graph.basics.startDate,
        endDate: graph.basics.endDate,
        departureCity: graph.basics.departureCity,
        returnCity: graph.basics.returnCity,
      },
    );
    assert.equal(travelLayouts.size, 0);
    assert.equal(transitOverlays.size, 0);
  });

  it("flight legs remain in transport graph after calendar transit removal", () => {
    let graph = setupStateToGraph("t1", baseState());
    graph = applyCommands(graph, []).graph;
    assert.equal(graph.intercityLegs.length, 1);
    assert.equal(graph.intercityLegs[0]?.flightNumber, "JL123");
  });
});
