import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildJapanPartyGraph,
  japanPartyRoster,
  paintPartyTottoriFork,
} from "@/lib/trip-admin/fixtures/japan-kaleb";

import { setupStateToGraph } from "./adapters";
import { applyCommands } from "./apply-commands";
import { expandCommandsForCalendarLens } from "./calendar-lens-dispatch";
import {
  detectMissingOutboundFlight,
  detectMissingReturnFlight,
  pendingTransportNeedsFromCalendar,
  transportLegCoversCityMove,
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

describe("detectMissingReturnFlight", () => {
  it("flags Tokyo to Christchurch when the last trip day is abroad without a travel split", () => {
    const state = japanOutboundState();
    state.dayPlacesByGroupId.main = [
      {
        date: "2026-12-05",
        primaryCity: "Christchurch",
        secondaryCity: "Tokyo, Japan",
        primaryShare: 0.5,
        dayType: "travel",
        includeBuffer: false,
      },
      {
        date: "2026-12-18",
        primaryCity: "Kyoto",
        secondaryCity: "Tokyo",
        primaryShare: 0.5,
        dayType: "travel",
        includeBuffer: false,
      },
      {
        date: "2026-12-19",
        primaryCity: "Tokyo",
        secondaryCity: null,
        primaryShare: 1,
        dayType: "trip",
        includeBuffer: false,
      },
      {
        date: "2026-12-20",
        primaryCity: "Tokyo",
        secondaryCity: null,
        primaryShare: 1,
        dayType: "trip",
        includeBuffer: false,
      },
      {
        date: "2026-12-21",
        primaryCity: "Tokyo",
        secondaryCity: null,
        primaryShare: 1,
        dayType: "trip",
        includeBuffer: false,
      },
    ];
    const move = detectMissingReturnFlight(
      state.dayPlacesByGroupId.main ?? [],
      state.basics,
    );
    assert.ok(move);
    assert.match(move.fromCity, /Tokyo/i);
    assert.match(move.toCity, /Christchurch/i);
    assert.equal(move.date, "2026-12-21");
  });
});

describe("pendingTransportNeedsFromCalendar", () => {
  it("flags Kyoto → Tokyo travel split when no intercity leg exists", () => {
    const graph = setupStateToGraph("trip-1", baseState());
    const pending = pendingTransportNeedsFromCalendar(graph, "main");
    assert.equal(pending.length, 2);
    const intercity = pending.find((need) => need.kind === "intercity");
    assert.equal(intercity?.fromCity, "Kyoto");
    assert.equal(intercity?.toCity, "Tokyo");
    assert.equal(intercity?.date, "2026-12-23");
    assert.ok(pending.some((need) => need.kind === "return_flight"));
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

  it("includes return flight when the trip ends abroad without a home travel split", () => {
    const state = japanOutboundState();
    state.dayPlacesByGroupId.main = [
      {
        date: "2026-12-05",
        primaryCity: "Christchurch",
        secondaryCity: "Tokyo, Japan",
        primaryShare: 0.5,
        dayType: "travel",
        includeBuffer: false,
      },
      {
        date: "2026-12-18",
        primaryCity: "Kyoto",
        secondaryCity: "Tokyo",
        primaryShare: 0.5,
        dayType: "travel",
        includeBuffer: false,
      },
      {
        date: "2026-12-21",
        primaryCity: "Tokyo",
        secondaryCity: null,
        primaryShare: 1,
        dayType: "trip",
        includeBuffer: false,
      },
    ];
    const graph = setupStateToGraph("trip-1", state);
    const pending = pendingTransportNeedsFromCalendar(graph, "main");
    const returnNeed = pending.find((need) => need.kind === "return_flight");
    assert.ok(returnNeed);
    assert.match(returnNeed.fromCity, /Tokyo/i);
    assert.match(returnNeed.toCity, /Christchurch/i);
    assert.equal(returnNeed.date, "2026-12-21");
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
    const pending = pendingTransportNeedsFromCalendar(graph, "main");
    assert.equal(pending.length, 1);
    assert.equal(pending[0]?.kind, "return_flight");
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

  it("personal subgroup leg covers same-day gap when calendar fromCity drifted", () => {
    const move = {
      fromCity: "Kagoshima",
      toCity: "Tottori",
      date: "2026-12-06",
    };
    const leg = {
      id: "leg-tottori",
      transportType: "train" as const,
      bookingStatus: "not_booked" as const,
      travelDate: "2026-12-06",
      departureTime: null,
      arrivalTime: null,
      fromCity: "Tokyo",
      toCity: "Tottori",
      fromStation: null,
      toStation: null,
      operator: null,
      referenceNumber: null,
      notes: null,
      originGroupId: "g-amanda",
      intercityFromCity: "Tokyo",
      intercityToCity: "Tottori",
      intercityKind: "city_change" as const,
      surfaceOnly: false,
    };
    assert.ok(transportLegCoversCityMove(leg, move, { scopeGroupId: "g-amanda" }));
  });

  it("main-group leg does not cover personal fork when only destination matches", () => {
    const move = {
      fromCity: "Tottori",
      toCity: "Hiroshima",
      date: "2026-12-13",
    };
    const mainLeg = {
      id: "leg-kag-hiro",
      transportType: "train" as const,
      bookingStatus: "not_booked" as const,
      travelDate: "2026-12-13",
      arrivalDate: null,
      departureTime: null,
      arrivalTime: null,
      fromCity: "Kagoshima",
      toCity: "Hiroshima",
      fromStation: null,
      toStation: null,
      operator: null,
      referenceNumber: null,
      flightNumber: null,
      notes: null,
      originGroupId: "g-main",
      intercityFromCity: "Kagoshima",
      intercityToCity: "Hiroshima",
      surfaceOnly: false,
    };
    assert.equal(
      transportLegCoversCityMove(mainLeg, move, { scopeGroupId: "g-amanda" }),
      false,
    );
  });

  it("party Tottori fork surfaces Tottori to Hiroshima when rejoining main corridor", () => {
    const roster = japanPartyRoster();
    let graph = paintPartyTottoriFork(buildJapanPartyGraph(), roster);

    const rejoinCommands = expandCommandsForCalendarLens(
      [
        {
          type: "paintDayRange",
          groupId: "g-amanda",
          rangeStart: "2026-12-13",
          rangeEnd: "2026-12-14",
          location: "Hiroshima",
          startHalf: "pm",
          endHalf: "full",
        },
      ],
      {
        kind: "party",
        participantIds: ["p-amanda", "p-kaleb", "p-mia", "p-trenuela"],
      },
      graph,
      roster,
    );
    graph = applyCommands(graph, rejoinCommands).graph;
    graph = applyCommands(graph, [
      {
        type: "addTransportLeg",
        groupId: "g-main",
        bucket: "intercity",
        leg: {
          id: "leg-kag-hiro",
          transportType: "train",
          bookingStatus: "not_booked",
          travelDate: "2026-12-13",
          arrivalDate: null,
          departureTime: null,
          arrivalTime: null,
          fromCity: "Kagoshima",
          toCity: "Hiroshima",
          fromStation: null,
          toStation: null,
          operator: null,
          referenceNumber: null,
          flightNumber: null,
          notes: null,
          intercityFromCity: "Kagoshima",
          intercityToCity: "Hiroshima",
          originGroupId: graph.mainGroupId,
          sourceEntityId: null,
        },
      },
    ]).graph;

    const pending = pendingTransportNeedsFromCalendar(graph, "g-amanda").filter(
      (need) => need.kind === "intercity",
    );
    assert.ok(
      pending.some(
        (need) =>
          need.date === "2026-12-13" &&
          need.fromCity.includes("Tottori") &&
          need.toCity.includes("Hiroshima"),
      ),
    );
  });
});
