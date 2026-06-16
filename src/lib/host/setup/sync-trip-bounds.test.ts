import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { syncTripBoundsFromContent, uncoveredTripDays } from "./sync-trip-bounds";
import type { TripSetupState } from "./types";
import { newId } from "@/lib/host/wizard/types";

function baseState(): TripSetupState {
  return {
    basics: {
      name: "Trip",
      schoolName: "School",
      startDate: "2026-06-10",
      endDate: "2026-09-05",
      timezone: "Pacific/Auckland",
      departureCity: "Christchurch, New Zealand",
      returnCity: "Christchurch, New Zealand",
      defaultDepartureAirport: "",
      destinationCountries: ["Thailand"],
    },
    mainGroupId: "main",
    groups: [{ id: "main", name: "Main Group", sortOrder: 0, isMain: true }],
    dayPlacesByGroupId: {
      main: [
        {
          date: "2026-06-10",
          primaryCity: "",
          secondaryCity: null,
          primaryShare: 1,
          dayType: "trip",
          includeBuffer: false,
        },
      ],
    },
    outboundLegs: [
      {
        id: newId(),
        transportType: "plane",
        bookingStatus: "not_booked",
        travelDate: "2026-08-23",
        arrivalDate: "2026-08-23",
        departureTime: "06:20",
        arrivalTime: "20:40",
        fromCity: "Christchurch Airport (CHC)",
        toCity: "Phuket International Airport (HKT)",
        fromStation: null,
        toStation: null,
        operator: null,
        referenceNumber: null,
        flightNumber: "JQ172",
        notes: null,
      },
    ],
    returnLegs: [],
    intercityLegs: [],
    accommodationStays: [
      {
        id: newId(),
        cityLabel: "Patong",
        stayType: "hotel",
        name: "Royal Paradise Hotel",
        url: null,
        address: null,
        phone: null,
        checkInDate: "2026-08-20",
        checkOutDate: "2026-09-01",
        notes: null,
        isHomestayGroup: false,
        multipleInCity: false,
        originGroupId: "main",
      },
    ],
    activities: [],
    overlayOps: [],
  };
}

describe("syncTripBoundsFromContent", () => {
  it("shrinks stale trip dates to current stays and transport", () => {
    const next = syncTripBoundsFromContent(baseState());
    assert.equal(next.basics.startDate, "2026-08-20");
    assert.equal(next.basics.endDate, "2026-08-31");
  });
});

describe("uncoveredTripDays", () => {
  it("ignores scroll padding outside the trip range", () => {
    const days = [
      {
        date: "2026-07-01",
        primaryCity: "",
        secondaryCity: null,
        primaryShare: 1,
        dayType: "trip" as const,
        includeBuffer: false,
      },
      {
        date: "2026-08-25",
        primaryCity: "",
        secondaryCity: null,
        primaryShare: 1,
        dayType: "trip" as const,
        includeBuffer: false,
      },
    ];
    const uncovered = uncoveredTripDays(days, "2026-08-20", "2026-08-31");
    assert.equal(uncovered.length, 1);
    assert.equal(uncovered[0]?.date, "2026-08-25");
  });

  it("returns nothing when trip dates are still unset", () => {
    const days = [
      {
        date: "2000-01-01",
        primaryCity: "",
        secondaryCity: null,
        primaryShare: 1,
        dayType: "trip" as const,
        includeBuffer: false,
      },
    ];
    assert.equal(uncoveredTripDays(days, "2000-01-01", "2000-01-01").length, 0);
  });
});
