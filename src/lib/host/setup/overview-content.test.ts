import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildOverviewNextSteps, buildOverviewSummary } from "./overview-content";
import type { TripSetupState } from "./types";

function emptyState(): TripSetupState {
  return {
    basics: {
      name: "Thailand trip",
      startDate: "2000-01-01",
      endDate: "2000-01-01",
      departureCity: "",
      returnCity: "",
      destinationCountries: [],
      timezone: "Pacific/Auckland",
      schoolName: "",
    },
    mainGroupId: "main",
    groups: [],
    dayPlacesByGroupId: { main: [] },
    outboundLegs: [],
    returnLegs: [],
    intercityLegs: [],
    accommodationStays: [],
    activities: [],
    overlayOps: [],
  };
}

describe("buildOverviewNextSteps", () => {
  it("suggests locations first on a blank trip", () => {
    const steps = buildOverviewNextSteps(emptyState());
    assert.equal(steps[0]?.id, "locations");
    assert.match(steps[0]!.detail, /calendar/i);
  });
});

describe("buildOverviewSummary", () => {
  it("lists stays and legs once added", () => {
    const state = {
      ...emptyState(),
      accommodationStays: [
        {
          id: "s1",
          cityLabel: "Bangkok",
          stayType: "hotel",
          name: "Centre Point",
          url: null,
          address: null,
          phone: null,
          checkInDate: "2026-09-01",
          checkOutDate: "2026-09-05",
          notes: null,
          isHomestayGroup: false,
          multipleInCity: false,
        },
      ],
      returnLegs: [
        {
          id: "r1",
          transportType: "plane",
          bookingStatus: "not_booked",
          travelDate: "2026-09-04",
          arrivalDate: null,
          departureTime: null,
          arrivalTime: null,
          fromCity: "Bangkok",
          toCity: "Melbourne",
          fromStation: null,
          toStation: null,
          operator: null,
          referenceNumber: null,
          flightNumber: "NZ123",
          notes: null,
        },
      ],
    } satisfies TripSetupState;

    const summary = buildOverviewSummary(state);
    assert.ok(summary.some((line) => line.label === "Accommodation"));
    assert.ok(summary.some((line) => line.label === "Return"));
  });
});
