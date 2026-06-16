import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { transportStatusItems } from "@/lib/host/setup/section-status-items";
import type { TripSetupState } from "@/lib/host/setup/types";

function minimalState(): TripSetupState {
  return {
    basics: {
      name: "Japan 2026",
      schoolName: "School",
      startDate: "2026-03-10",
      endDate: "2026-03-20",
      destinationCountries: ["Japan"],
      destinationLanguages: [],
      timezone: "Pacific/Auckland",
      departureCity: "Auckland",
      returnCity: "Auckland",
    },
    mainGroupId: "main",
    groups: [{ id: "main", name: "Main Group", type: "main", description: null, sortOrder: 0, isMain: true }],
    dayPlacesByGroupId: { main: [] },
    outboundLegs: [],
    returnLegs: [],
    intercityLegs: [],
    accommodationStays: [],
    activities: [],
    overlayOps: [],
  };
}

describe("transportStatusItems", () => {
  it("prompts for outbound and return when missing", () => {
    const items = transportStatusItems(minimalState(), "main");
    const outbound = items.find((i) => i.id === "outbound");
    const ret = items.find((i) => i.id === "return");
    assert.equal(outbound?.prompt, "How are you getting to the destination?");
    assert.equal(ret?.prompt, "How are you getting home?");
    assert.equal(outbound?.status, "todo");
  });
});
