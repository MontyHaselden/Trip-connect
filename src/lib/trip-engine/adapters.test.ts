import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { graphToSetupState, setupStateToGraph } from "./adapters";
import type { TripSetupState } from "@/lib/host/setup/types";

const sample: TripSetupState = {
  basics: {
    name: "Test",
    schoolName: "",
    startDate: "2026-01-01",
    endDate: "2026-01-05",
    timezone: "UTC",
    departureCity: "",
    returnCity: "",
    defaultDepartureAirport: "",
    destinationCountries: [],
  },
  mainGroupId: "g1",
  groups: [],
  dayPlacesByGroupId: {},
  outboundLegs: [],
  returnLegs: [],
  intercityLegs: [],
  accommodationStays: [],
  activities: [],
  overlayOps: [],
};

describe("trip-engine adapters", () => {
  it("round-trips graph ↔ setup state without engine summaries", () => {
    const graph = setupStateToGraph("trip-abc", sample);
    assert.equal(graph.tripId, "trip-abc");
    assert.equal(graph.bookingsSummary.length, 0);
    const restored = graphToSetupState(graph);
    assert.deepEqual(restored, sample);
  });
});
