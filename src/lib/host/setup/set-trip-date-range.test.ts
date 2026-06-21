import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { applyTripDateRange } from "./set-trip-date-range";
import type { TripSetupState } from "@/lib/host/setup/types";

function baseState(): TripSetupState {
  return {
    basics: {
      name: "Europe",
      schoolName: "School",
      startDate: "2028-07-10",
      endDate: "2028-07-30",
      timezone: "Europe/London",
      departureCity: "Christchurch",
      returnCity: "Christchurch",
      defaultDepartureAirport: null,
      destinationCountries: [],
    },
    mainGroupId: "main-group",
    groups: [
      {
        id: "main-group",
        name: "Everyone",
        type: "main",
        description: null,
        sortOrder: 0,
        isMain: true,
      },
    ],
    dayPlacesByGroupId: {
      "main-group": [
        {
          date: "2028-07-10",
          primaryCity: "London",
          secondaryCity: null,
          primaryShare: 1,
          dayType: "trip",
          includeBuffer: false,
        },
        {
          date: "2028-07-16",
          primaryCity: "Paris",
          secondaryCity: null,
          primaryShare: 1,
          dayType: "trip",
          includeBuffer: false,
        },
        {
          date: "2028-07-28",
          primaryCity: "Rome",
          secondaryCity: null,
          primaryShare: 1,
          dayType: "trip",
          includeBuffer: false,
        },
      ],
    },
    outboundLegs: [
      {
        id: "leg-out",
        transportType: "plane",
        bookingStatus: "not_booked",
        travelDate: "2028-07-09",
        fromCity: "Christchurch",
        toCity: "London",
        flightNumber: null,
        departureTime: null,
        arrivalTime: null,
        fromStation: null,
        toStation: null,
        operator: null,
        referenceNumber: null,
        notes: null,
        legKind: "outbound",
        intercityFromCity: null,
        intercityToCity: null,
        visibilityMode: "everyone",
        originGroupId: null,
        sourceEntityId: null,
      },
    ],
    returnLegs: [],
    intercityLegs: [],
    accommodationStays: [
      {
        id: "stay-1",
        cityLabel: "Paris",
        stayType: "hotel",
        name: "Hotel",
        url: null,
        address: null,
        phone: null,
        checkInDate: "2028-07-15",
        checkOutDate: "2028-07-20",
        notes: null,
        isHomestayGroup: false,
        multipleInCity: false,
        originGroupId: null,
        sourceEntityId: null,
        visibilityMode: "everyone",
      },
    ],
    activities: [
      {
        id: "act-1",
        title: "Louvre",
        date: "2028-07-09",
        endDate: null,
        startTime: "10:00",
        endTime: null,
        isTimeTbc: false,
        category: "activity",
        locationName: null,
        address: null,
        isLocationTbc: true,
        transportNote: null,
        leaveByTime: null,
        bringNote: null,
        description: null,
        audienceType: "everyone",
        audienceId: null,
        bookingStatus: "not_booked",
      },
      {
        id: "act-2",
        title: "Eiffel",
        date: "2028-07-18",
        endDate: null,
        startTime: "14:00",
        endTime: null,
        isTimeTbc: false,
        category: "activity",
        locationName: null,
        address: null,
        isLocationTbc: true,
        transportNote: null,
        leaveByTime: null,
        bringNote: null,
        description: null,
        audienceType: "everyone",
        audienceId: null,
        bookingStatus: "not_booked",
      },
    ],
    overlayOps: [],
  };
}

describe("applyTripDateRange", () => {
  it("trims calendar paint and cascades to stays, transport, and activities", () => {
    const next = applyTripDateRange(baseState(), {
      startDate: "2028-07-16",
      endDate: "2028-07-26",
    });

    assert.equal(next.basics.startDate, "2028-07-16");
    assert.equal(next.basics.endDate, "2028-07-26");
    assert.deepEqual(
      (next.dayPlacesByGroupId["main-group"] ?? []).map((day) => day.date),
      ["2028-07-16"],
    );
    assert.equal(next.outboundLegs.length, 0);
    assert.equal(next.activities.length, 1);
    assert.equal(next.activities[0]?.title, "Eiffel");
    assert.equal(next.accommodationStays[0]?.checkInDate, "2028-07-16");
    assert.equal(next.accommodationStays[0]?.checkOutDate, "2028-07-20");
  });
});
