import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  reconcileImportedSetupState,
  summarizeSetupCalendarGaps,
} from "@/lib/host/import/post-import-reconcile";
import type { TripSetupState } from "@/lib/host/setup/types";
import type { DayPlaceDraft } from "@/lib/host/wizard/types";

function euroTripState(): TripSetupState {
  return {
    basics: {
      name: "Euro 2026",
      schoolName: "Test",
      startDate: "2026-06-16",
      endDate: "2026-07-26",
      timezone: "Europe/London",
      departureCity: "Christchurch",
      returnCity: "Christchurch",
      defaultDepartureAirport: null,
      destinationCountries: ["Europe"],
    },
    mainGroupId: "main",
    groups: [
      {
        id: "main",
        name: "Everyone",
        type: "main",
        description: null,
        sortOrder: 0,
        isMain: true,
      },
    ],
    dayPlacesByGroupId: {
      main: [
        {
          date: "2026-07-07",
          primaryCity: "London",
          secondaryCity: null,
          primaryShare: 1,
          dayType: "trip",
          includeBuffer: false,
        },
        {
          date: "2026-07-12",
          primaryCity: "London",
          secondaryCity: null,
          primaryShare: 1,
          dayType: "trip",
          includeBuffer: false,
        },
        {
          date: "2026-07-19",
          primaryCity: "London",
          secondaryCity: "Paris",
          primaryShare: 0.5,
          dayType: "travel",
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

describe("post-import reconcile", () => {
  it("fills empty London days between anchors", () => {
    const { state, filledDayCount } = reconcileImportedSetupState(euroTripState());
    const days = state.dayPlacesByGroupId.main ?? [];
    const jul15 = days.find((day) => day.date === "2026-07-15");

    assert.ok(filledDayCount >= 5);
    assert.equal(jul15?.primaryCity, "London");
  });

  it("reports missing transport when the calendar jumps cities without a leg", () => {
    const state = euroTripState();
    state.dayPlacesByGroupId.main = [
      {
        date: "2026-07-18",
        primaryCity: "London",
        secondaryCity: null,
        primaryShare: 1,
        dayType: "trip",
        includeBuffer: false,
      },
      {
        date: "2026-07-19",
        primaryCity: "Paris",
        secondaryCity: null,
        primaryShare: 1,
        dayType: "trip",
        includeBuffer: false,
      },
    ];
    const gaps = summarizeSetupCalendarGaps(state);
    assert.ok(
      gaps.missingTransport.some(
        (move) => move.fromCity === "London" && move.toCity === "Paris",
      ),
    );
  });

  it("fills Tokyo days between arrival and return flight after flight reconcile", () => {
    const state = euroTripState();
    state.basics.startDate = "2026-12-16";
    state.basics.endDate = "2026-12-22";
    state.dayPlacesByGroupId.main = [
      day("2026-12-16", "Kyoto"),
      day("2026-12-17", "Kyoto"),
      day("2026-12-18", "Kyoto"),
      day("2026-12-19", "Kyoto"),
      day("2026-12-20", ""),
      day("2026-12-21", ""),
      day("2026-12-22", "Christchurch"),
    ];
    state.intercityLegs = [
      {
        id: "kyoto-tokyo",
        transportType: "train",
        bookingStatus: "not_booked",
        travelDate: "2026-12-19",
        arrivalDate: null,
        departureTime: null,
        arrivalTime: null,
        intercityFromCity: "Kyoto",
        intercityToCity: "Tokyo",
        fromCity: "Kyoto",
        toCity: "Tokyo",
        fromStation: null,
        toStation: null,
        operator: null,
        referenceNumber: null,
        flightNumber: null,
        notes: null,
        legKind: "intercity",
      },
    ];
    state.returnLegs = [
      {
        id: "tokyo-home",
        transportType: "plane",
        bookingStatus: "not_booked",
        travelDate: "2026-12-22",
        arrivalDate: "2026-12-22",
        departureTime: "10:00",
        arrivalTime: "20:00",
        fromCity: "Narita Airport (NRT), Japan",
        toCity: "Christchurch Airport (CHC), New Zealand",
        fromStation: null,
        toStation: null,
        operator: null,
        referenceNumber: null,
        flightNumber: "NZ123",
        notes: null,
      },
    ];

    const { state: reconciled, filledDayCount } = reconcileImportedSetupState(state);
    const days = reconciled.dayPlacesByGroupId.main ?? [];

    assert.ok(filledDayCount >= 2);
    assert.equal(days.find((d) => d.date === "2026-12-20")?.primaryCity.includes("Tokyo"), true);
    assert.equal(days.find((d) => d.date === "2026-12-21")?.primaryCity.includes("Tokyo"), true);
  });
});

function day(date: string, primaryCity: string, overrides: Partial<DayPlaceDraft> = {}): DayPlaceDraft {
  return {
    date,
    primaryCity,
    secondaryCity: null,
    primaryShare: 1,
    dayType: "trip",
    includeBuffer: false,
    ...overrides,
  };
}
