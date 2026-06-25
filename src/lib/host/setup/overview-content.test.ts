import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildOverviewNextSteps, buildOverviewSummarySections } from "./overview-content";
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

describe("buildOverviewSummarySections", () => {
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

    const snapshot = buildOverviewSummarySections(state);
    assert.ok(snapshot.sections.some((section) => section.id === "accommodation"));
    assert.ok(snapshot.sections.some((section) => section.id === "travel"));
  });

  it("dedupes duplicate transport leg ids", () => {
    const legId = "99bd9981-c5fe-46de-97f3-dfcb5c1d42c2";
    const leg = {
      id: legId,
      transportType: "train",
      bookingStatus: "not_booked",
      travelDate: "2026-12-05",
      arrivalDate: null,
      departureTime: null,
      arrivalTime: null,
      intercityFromCity: "Tokyo",
      intercityToCity: "Kyoto",
      fromStation: null,
      toStation: null,
      operator: null,
      referenceNumber: null,
      flightNumber: null,
      notes: null,
      surfaceOnly: false,
    };
    const state = {
      ...emptyState(),
      intercityLegs: [leg, { ...leg }],
    } satisfies TripSetupState;

    const snapshot = buildOverviewSummarySections(state);
    const travel = snapshot.sections.find((section) => section.id === "travel");
    const icItems = travel?.items.filter((item) => item.id === `ic-${legId}`) ?? [];
    assert.equal(icItems.length, 1);
  });
});
