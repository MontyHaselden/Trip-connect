import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { applySetupTransportChange } from "@/lib/host/setup/apply-setup-transport";
import { patongStay } from "@/lib/host/setup/calendar-fixtures";
import { syncStaysToDestinationArrivals } from "@/lib/host/setup/sync-stays-to-arrivals";
import type { TripSetupState } from "@/lib/host/setup/types";
import { newId } from "@/lib/host/wizard/types";

function baseState(): TripSetupState {
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
    dayPlacesByGroupId: {
      main: [
        {
          date: "2026-08-20",
          primaryCity: "Patong",
          secondaryCity: null,
          primaryShare: 0.5,
          dayType: "trip",
          includeBuffer: false,
        },
        {
          date: "2026-08-21",
          primaryCity: "Patong",
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
    accommodationStays: [
      patongStay({
        checkInDate: "2026-08-20",
        checkOutDate: "2026-08-31",
      }),
    ],
    activities: [],
    overlayOps: [],
  };
}

describe("syncStaysToDestinationArrivals", () => {
  it("pushes Patong check-in to outbound arrival when stay started too early", () => {
    const outbound = {
      id: newId(),
      transportType: "plane" as const,
      bookingStatus: "placeholder" as const,
      travelDate: "2026-08-23",
      arrivalDate: "2026-08-24",
      departureTime: "21:00",
      arrivalTime: "09:00",
      fromCity: "Christchurch Airport (CHC)",
      toCity: "Phuket International Airport (HKT)",
      fromStation: null,
      toStation: null,
      operator: null,
      referenceNumber: null,
      flightNumber: "JQ30",
      notes: null,
    };

    const synced = syncStaysToDestinationArrivals(baseState().accommodationStays, {
      outboundLegs: [outbound],
      returnLegs: [],
      intercityLegs: [],
    });

    assert.equal(synced[0]?.checkInDate, "2026-08-24");
  });
});

describe("applySetupTransportChange with named stays", () => {
  it("rebuilds calendar from arrival onward and drops earlier Patong paint", () => {
    const outbound = {
      id: newId(),
      transportType: "plane" as const,
      bookingStatus: "placeholder" as const,
      travelDate: "2026-08-23",
      arrivalDate: "2026-08-24",
      departureTime: "21:00",
      arrivalTime: "09:00",
      fromCity: "Christchurch Airport (CHC)",
      toCity: "Phuket International Airport (HKT)",
      fromStation: null,
      toStation: null,
      operator: null,
      referenceNumber: null,
      flightNumber: "JQ30",
      notes: null,
    };

    const next = applySetupTransportChange(baseState(), { outboundLegs: [outbound] });
    const days = next.dayPlacesByGroupId.main ?? [];

    assert.equal(next.accommodationStays[0]?.checkInDate, "2026-08-24");
    assert.equal(next.basics.endDate, "2026-08-31");
    assert.ok(!days.find((d) => d.date === "2026-08-21")?.primaryCity.trim());
    assert.ok(!days.find((d) => d.date === "2026-08-22")?.primaryCity.trim());
    const aug20 = days.find((d) => d.date === "2026-08-20");
    assert.ok(!aug20?.primaryCity.includes("Patong"));
    assert.ok(!aug20?.secondaryCity?.includes("Patong"));

    const dep = days.find((d) => d.date === "2026-08-23");
    const arr = days.find((d) => d.date === "2026-08-24");
    assert.ok(dep?.primaryCity.includes("Christchurch") || dep?.primaryCity === "Christchurch");
    assert.ok(
      arr?.secondaryCity?.includes("Patong") ||
        arr?.primaryCity.includes("Patong") ||
        arr?.secondaryCity?.includes("Phuket"),
    );

    const aug25 = days.find((d) => d.date === "2026-08-25");
    assert.ok(aug25?.primaryCity.includes("Patong") || aug25?.primaryCity === "Patong");
  });
});
