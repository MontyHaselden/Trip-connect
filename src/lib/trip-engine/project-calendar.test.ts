import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { setupStateToGraph } from "./adapters";
import { projectCalendar } from "./project-calendar";
import type { TripSetupState } from "@/lib/host/setup/types";

function stateWithStay(): TripSetupState {
  return {
    basics: {
      name: "Japan",
      schoolName: "",
      startDate: "2026-08-28",
      endDate: "2026-09-02",
      timezone: "Asia/Tokyo",
      departureCity: "Sydney",
      returnCity: "Sydney",
      defaultDepartureAirport: "",
      destinationCountries: ["Japan"],
    },
    mainGroupId: "g1",
    groups: [
      {
        id: "g1",
        name: "Main",
        type: "main",
        description: null,
        sortOrder: 0,
        isMain: true,
      },
    ],
    dayPlacesByGroupId: { g1: [] },
    outboundLegs: [],
    returnLegs: [],
    intercityLegs: [],
    accommodationStays: [
      {
        id: "stay-1",
        cityLabel: "Tokyo",
        stayType: "hotel",
        name: "Grand Hotel",
        url: null,
        address: null,
        phone: null,
        checkInDate: "2026-08-28",
        checkOutDate: "2026-08-31",
        notes: null,
        isHomestayGroup: false,
        multipleInCity: false,
      },
    ],
    activities: [],
    overlayOps: [],
  };
}

describe("projectCalendar", () => {
  it("projects accommodation labels for named stays", () => {
    const graph = setupStateToGraph("trip-1", stateWithStay());
    const projection = projectCalendar(graph);

    assert.ok(projection.accommodationByDate.has("2026-08-28"));
    assert.equal(projection.accommodationByDate.get("2026-08-28"), "Grand Hotel");
    assert.ok(projection.days.length > 0);
  });

  it("is deterministic for same input", () => {
    const graph = setupStateToGraph("trip-1", stateWithStay());
    const a = projectCalendar(graph);
    const b = projectCalendar(graph);
    assert.deepEqual(
      a.days.map((d) => d.date),
      b.days.map((d) => d.date),
    );
  });
});
