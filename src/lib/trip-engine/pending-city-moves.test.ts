import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { setupStateToGraph } from "./adapters";
import {
  detectMissingOutboundFlight,
  pendingTransportNeedsFromCalendar,
} from "./pending-city-moves";
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

function japanOutboundState(): TripSetupState {
  return {
    ...baseState(),
    basics: {
      ...baseState().basics,
      startDate: "2026-12-05",
      endDate: "2026-12-21",
    },
    dayPlacesByGroupId: {
      main: [
        {
          date: "2026-12-05",
          primaryCity: "Christchurch",
          secondaryCity: "Tokyo, Japan",
          primaryShare: 0.5,
          dayType: "travel",
          includeBuffer: false,
        },
        {
          date: "2026-12-06",
          primaryCity: "Tokyo, Japan",
          secondaryCity: "Kagoshima",
          primaryShare: 0.5,
          dayType: "travel",
          includeBuffer: false,
        },
        {
          date: "2026-12-21",
          primaryCity: "Tokyo",
          secondaryCity: "Christchurch, New Zealand",
          primaryShare: 0.5,
          dayType: "travel",
          includeBuffer: false,
        },
      ],
    },
  };
}

describe("detectMissingOutboundFlight", () => {
  it("flags Christchurch to Tokyo on the first trip day", () => {
    const state = japanOutboundState();
    const move = detectMissingOutboundFlight(
      state.dayPlacesByGroupId.main ?? [],
      state.basics,
    );
    assert.ok(move);
    assert.equal(move.fromCity, "Christchurch");
    assert.match(move.toCity, /Tokyo/i);
    assert.equal(move.date, "2026-12-05");
  });
});

describe("pendingTransportNeedsFromCalendar", () => {
  it("flags Kyoto → Tokyo travel split when no intercity leg exists", () => {
    const graph = setupStateToGraph("trip-1", baseState());
    const pending = pendingTransportNeedsFromCalendar(graph, "main");
    assert.equal(pending.length, 1);
    assert.equal(pending[0]?.fromCity, "Kyoto");
    assert.equal(pending[0]?.toCity, "Tokyo");
    assert.equal(pending[0]?.date, "2026-12-23");
    assert.equal(pending[0]?.kind, "intercity");
  });

  it("includes outbound and return flights for a Japan trip", () => {
    const graph = setupStateToGraph("trip-1", japanOutboundState());
    const pending = pendingTransportNeedsFromCalendar(graph, "main");
    const kinds = pending.map((need) => need.kind);
    assert.ok(kinds.includes("outbound_flight"));
    assert.ok(kinds.includes("return_flight"));
    const outbound = pending.find((need) => need.kind === "outbound_flight");
    assert.equal(outbound?.fromCity, "Christchurch");
    assert.match(outbound?.toCity ?? "", /Tokyo/i);
    assert.ok(!pending.some((need) => need.kind === "return_flight" && need.date === "2026-12-05"));
  });

  it("still flags Christchurch to Tokyo outbound when departure city is wrong", () => {
    const state = japanOutboundState();
    state.basics = {
      ...state.basics,
      departureCity: "Tokyo, Japan",
      returnCity: "Christchurch, New Zealand",
    };
    const graph = setupStateToGraph("trip-1", state);
    const pending = pendingTransportNeedsFromCalendar(graph, "main");
    const outbound = pending.find((need) => need.kind === "outbound_flight" && need.date === "2026-12-05");
    assert.ok(outbound);
    assert.match(outbound.fromCity, /Christchurch/i);
    assert.match(outbound.toCity, /Tokyo/i);
    assert.ok(!pending.some((need) => need.kind === "return_flight" && need.date === "2026-12-05"));
    const tokyoKagoshima = pending.find((need) => need.date === "2026-12-06");
    assert.equal(tokyoKagoshima?.kind, "intercity");
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
    assert.equal(pendingTransportNeedsFromCalendar(graph, "main").length, 0);
  });

  it("clears outbound flight when matching outbound leg exists", () => {
    const state = japanOutboundState();
    state.outboundLegs = [
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
        fromStation: "CHC",
        toStation: "NRT",
        operator: null,
        referenceNumber: null,
        flightNumber: "NZ99",
        notes: null,
      },
    ];
    const graph = setupStateToGraph("trip-1", state);
    const pending = pendingTransportNeedsFromCalendar(graph, "main");
    assert.ok(!pending.some((need) => need.kind === "outbound_flight"));
  });

  it("clears outbound flight when leg departs the day before the calendar arrival", () => {
    const state = japanOutboundState();
    state.dayPlacesByGroupId.main = [
      {
        date: "2026-12-05",
        primaryCity: "Christchurch",
        secondaryCity: null,
        primaryShare: 1,
        dayType: "trip",
        includeBuffer: false,
      },
      {
        date: "2026-12-06",
        primaryCity: "Christchurch",
        secondaryCity: "Tokyo, Japan",
        primaryShare: 0.5,
        dayType: "travel",
        includeBuffer: false,
      },
      ...(state.dayPlacesByGroupId.main ?? []).filter((day) => day.date > "2026-12-06"),
    ];
    state.outboundLegs = [
      {
        id: "out-1",
        transportType: "plane",
        bookingStatus: "not_booked",
        travelDate: "2026-12-05",
        arrivalDate: "2026-12-06",
        departureTime: null,
        arrivalTime: null,
        fromCity: "Christchurch",
        toCity: "Tokyo",
        fromStation: "CHC",
        toStation: "NRT",
        operator: null,
        referenceNumber: null,
        flightNumber: "NZ99",
        notes: null,
      },
    ];
    const graph = setupStateToGraph("trip-1", state);
    const pending = pendingTransportNeedsFromCalendar(graph, "main");
    assert.ok(!pending.some((need) => need.kind === "outbound_flight"));
  });

  it("clears overlay participant outbound when whole-group flight already exists", () => {
    const state: TripSetupState = {
      basics: {
        name: "Japan 2026",
        schoolName: "",
        startDate: "2026-12-05",
        endDate: "2026-12-21",
        timezone: "Asia/Tokyo",
        departureCity: "Christchurch",
        returnCity: "Christchurch",
        defaultDepartureAirport: "",
        destinationCountries: ["Japan"],
      },
      mainGroupId: "g-main",
      groups: [
        {
          id: "g-main",
          name: "Main",
          type: "main",
          description: null,
          sortOrder: 0,
          isMain: true,
          inheritMode: null,
          personalForParticipantId: null,
        },
        {
          id: "g-amanda",
          name: "Amanda",
          type: "split_travel",
          description: null,
          sortOrder: 1,
          isMain: false,
          inheritMode: "overlay",
          personalForParticipantId: "p-amanda",
        },
      ],
      dayPlacesByGroupId: {
        "g-main": [
          {
            date: "2026-12-06",
            primaryCity: "Tokyo, Japan",
            secondaryCity: "Kagoshima",
            primaryShare: 0.5,
            dayType: "travel",
            includeBuffer: false,
          },
          {
            date: "2026-12-07",
            primaryCity: "Kagoshima",
            secondaryCity: null,
            primaryShare: 1,
            dayType: "trip",
            includeBuffer: false,
          },
        ],
        "g-amanda": [
          {
            date: "2026-12-05",
            primaryCity: "Christchurch",
            secondaryCity: null,
            primaryShare: 1,
            dayType: "trip",
            includeBuffer: false,
          },
          {
            date: "2026-12-06",
            primaryCity: "Christchurch",
            secondaryCity: "Tokyo, Japan",
            primaryShare: 0.5,
            dayType: "travel",
            includeBuffer: false,
          },
          {
            date: "2026-12-07",
            primaryCity: "Kagoshima",
            secondaryCity: null,
            primaryShare: 1,
            dayType: "trip",
            includeBuffer: false,
          },
        ],
      },
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
          fromStation: "CHC",
          toStation: "NRT",
          operator: null,
          referenceNumber: null,
          flightNumber: "NZ99",
          notes: null,
        },
      ],
      returnLegs: [],
      intercityLegs: [],
      accommodationStays: [],
      activities: [],
      overlayOps: [],
    };

    const graph = setupStateToGraph("trip-1", state);
    const pending = pendingTransportNeedsFromCalendar(graph, "g-amanda");
    assert.ok(!pending.some((need) => need.kind === "outbound_flight"));
  });
});
