import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { clearEverythingFromDay } from "./clear-day-content";
import type { TripSetupState } from "./types";
import { newId } from "@/lib/host/wizard/types";

function baseState(): TripSetupState {
  return {
    basics: {
      name: "Trip",
      schoolName: "School",
      startDate: "2026-08-20",
      endDate: "2026-08-31",
      timezone: "Pacific/Auckland",
      departureCity: "Christchurch",
      returnCity: "Christchurch",
      defaultDepartureAirport: "",
      destinationCountries: ["Thailand"],
    },
    mainGroupId: "main",
    groups: [{ id: "main", name: "Main Group", sortOrder: 0, isMain: true }],
    dayPlacesByGroupId: {
      main: [
        {
          date: "2026-08-31",
          primaryCity: "Patong",
          secondaryCity: "Bangkok",
          primaryShare: 0.5,
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
        travelDate: "2026-08-31",
        arrivalDate: "2026-08-31",
        departureTime: "10:00",
        arrivalTime: "18:00",
        fromCity: "Phuket",
        toCity: "Bangkok",
        fromStation: null,
        toStation: null,
        operator: null,
        referenceNumber: null,
        flightNumber: "TG123",
        notes: null,
      },
    ],
    returnLegs: [],
    intercityLegs: [],
    accommodationStays: [
      {
        id: newId(),
        cityLabel: "Bangkok",
        stayType: "hotel",
        name: "Centre Point",
        url: null,
        address: null,
        phone: null,
        checkInDate: "2026-08-31",
        checkOutDate: "2026-09-01",
        notes: null,
        isHomestayGroup: false,
        multipleInCity: false,
        originGroupId: "main",
      },
    ],
    activities: [
      {
        id: newId(),
        title: "Temple visit",
        date: "2026-08-31",
        endDate: null,
        startTime: null,
        endTime: null,
        isTimeTbc: false,
        category: "sightseeing",
        locationName: null,
        address: null,
        isLocationTbc: false,
        transportNote: null,
        leaveByTime: null,
        bringNote: null,
        description: null,
      },
    ],
    overlayOps: [],
  };
}

describe("clearEverythingFromDay", () => {
  it("removes paint, stays, transport, and activities for one date", () => {
    const next = clearEverythingFromDay(baseState(), "2026-08-31", "main");
    const day = next.dayPlacesByGroupId.main?.find((d) => d.date === "2026-08-31");

    assert.equal(next.outboundLegs.length, 0);
    assert.equal(next.activities.length, 0);
    assert.equal(next.accommodationStays.length, 0);
    assert.ok(!day?.primaryCity.trim());
    assert.ok(!day?.secondaryCity?.trim());
  });
});
