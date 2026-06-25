import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { ActivityDraft } from "@/lib/host/wizard/types";

import { mergeActivitiesById, mergeClientActivitiesIntoGraph } from "./merge-graph-activities";
import { setupStateToGraph } from "./adapters";
import type { TripSetupState } from "@/lib/host/setup/types";

function activity(id: string, title: string): ActivityDraft {
  return {
    id,
    title,
    date: "2026-12-10",
    endDate: null,
    startTime: "09:00",
    endTime: null,
    isTimeTbc: false,
    category: "other",
    locationName: null,
    address: null,
    isLocationTbc: false,
    transportNote: null,
    leaveByTime: null,
    bringNote: null,
    description: null,
    audienceType: "everyone",
    audienceId: null,
    originGroupId: "main-group",
    bookingStatus: "not_booked",
  };
}

function emptyState(): TripSetupState {
  return {
    basics: {
      name: "Trip",
      schoolName: "School",
      startDate: "2026-12-04",
      endDate: "2026-12-22",
      timezone: "UTC",
      departureCity: "",
      returnCity: "",
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
    dayPlacesByGroupId: { "main-group": [] },
    outboundLegs: [],
    returnLegs: [],
    intercityLegs: [],
    accommodationStays: [],
    activities: [],
    overlayOps: [],
  };
}

describe("mergeActivitiesById", () => {
  it("unions server and client activities", () => {
    const merged = mergeActivitiesById(
      [activity("server-1", "From DB")],
      [activity("client-1", "From calendar"), activity("server-1", "Updated title")],
    );
    assert.equal(merged.length, 2);
    assert.equal(merged.find((row) => row.id === "client-1")?.title, "From calendar");
    assert.equal(merged.find((row) => row.id === "server-1")?.title, "Updated title");
  });
});

describe("mergeClientActivitiesIntoGraph", () => {
  it("adds client-only activities onto the server graph", () => {
    const graph = setupStateToGraph("trip-1", {
      ...emptyState(),
      activities: [activity("server-1", "DB activity")],
    });
    const merged = mergeClientActivitiesIntoGraph(graph, [
      activity("client-1", "Skytree"),
      activity("client-2", "Disneyland"),
    ]);
    assert.equal(merged.activities.length, 3);
  });
});
