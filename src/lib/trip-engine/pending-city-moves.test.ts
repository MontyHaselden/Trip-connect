import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { setupStateToGraph } from "./adapters";
import { pendingCityMovesFromCalendar } from "./pending-city-moves";
import type { TripSetupState } from "@/lib/host/setup/types";

function baseState(): TripSetupState {
  return {
    basics: {
      name: "Japan",
      schoolName: "",
      startDate: "2026-12-20",
      endDate: "2026-12-25",
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
    dayPlacesByGroupId: {
      main: [
        {
          date: "2026-12-22",
          primaryCity: "Kyoto",
          secondaryCity: null,
          primaryShare: 1,
          dayType: "trip",
          includeBuffer: false,
        },
        {
          date: "2026-12-23",
          primaryCity: "Kyoto",
          secondaryCity: "Tokyo",
          primaryShare: 0.5,
          dayType: "travel",
          includeBuffer: false,
        },
        {
          date: "2026-12-24",
          primaryCity: "Tokyo",
          secondaryCity: null,
          primaryShare: 1,
          dayType: "trip",
          includeBuffer: false,
        },
      ],
    },
    outboundLegs: [],
    returnLegs: [],
    intercityLegs: [],
    accommodationStays: [],
    activities: [],
    overlayOps: [],
  };
}

describe("pendingCityMovesFromCalendar", () => {
  it("flags Kyoto → Tokyo travel split when no intercity leg exists", () => {
    const graph = setupStateToGraph("trip-1", baseState());
    const pending = pendingCityMovesFromCalendar(graph, "main");
    assert.equal(pending.length, 1);
    assert.equal(pending[0]?.fromCity, "Kyoto");
    assert.equal(pending[0]?.toCity, "Tokyo");
    assert.equal(pending[0]?.date, "2026-12-23");
  });

  it("clears pending move when matching intercity leg exists", () => {
    const state = baseState();
    state.intercityLegs = [
      {
        id: "leg-1",
        legKind: "city_change",
        transportType: "train",
        bookingStatus: "not_booked",
        travelDate: "2026-12-23",
        arrivalDate: null,
        departureTime: null,
        arrivalTime: null,
        fromCity: "Kyoto",
        toCity: "Tokyo",
        fromStation: null,
        toStation: null,
        operator: null,
        referenceNumber: null,
        flightNumber: null,
        notes: null,
        intercityFromCity: "Kyoto",
        intercityToCity: "Tokyo",
      },
    ];
    const graph = setupStateToGraph("trip-1", state);
    assert.equal(pendingCityMovesFromCalendar(graph, "main").length, 0);
  });
});
