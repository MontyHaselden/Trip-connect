import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { computeLogisticsPrompts } from "./logistics-prompts";
import type { TripEntityGraph } from "./types";

function minimalGraph(overrides?: Partial<TripEntityGraph>): TripEntityGraph {
  return {
    tripId: "t1",
    basics: {
      name: "Test",
      schoolName: "School",
      startDate: "2026-08-01",
      endDate: "2026-08-10",
      timezone: "UTC",
      departureCity: "",
      returnCity: "",
      destinationCountries: [],
    },
    mainGroupId: "g1",
    groups: [{ id: "g1", name: "Main", type: "main", description: null, sortOrder: 0, isMain: true }],
    dayPlacesByGroupId: { g1: [] },
    outboundLegs: [],
    returnLegs: [],
    intercityLegs: [],
    accommodationStays: [],
    activities: [],
    overlayOps: [],
    bookingsSummary: [],
    emergencySummary: {
      localEmergencyNumber: null,
      schoolEmergencyPhone: null,
      contactsCount: 0,
      phrasesCount: 0,
    },
    publishSummary: {
      publishedVersion: 0,
      viewerGalleryEnabled: false,
      viewerRoomDetailsEnabled: false,
    },
    ...overrides,
  };
}

describe("computeLogisticsPrompts", () => {
  it("G4 flags booked stay without invoice reference", () => {
    const graph = minimalGraph({
      accommodationStays: [
        {
          id: "s1",
          cityLabel: "Kyoto",
          stayType: "hotel",
          name: "Kyoto Hotel",
          url: null,
          address: null,
          phone: null,
          checkInDate: "2026-08-02",
          checkOutDate: "2026-08-05",
          notes: null,
          isHomestayGroup: false,
          multipleInCity: false,
        },
      ],
      bookingsSummary: [
        {
          id: "b1",
          entityType: "accommodation_stay",
          entityId: "s1",
          bookingStatus: "booked",
          supplier: null,
          bookingReference: null,
        },
      ],
    });
    const prompts = computeLogisticsPrompts(graph);
    assert.ok(prompts.some((p) => p.message.includes("Kyoto Hotel")));
  });
});
