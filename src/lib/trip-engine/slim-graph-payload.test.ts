import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { slimGraphPayloadForEngine } from "./slim-graph-payload";
import type { TripEntityGraph } from "./types";

function graphWithDayPlaces(rows: Array<{ groupId: string; date: string }>): TripEntityGraph {
  const dayPlacesByGroupId: TripEntityGraph["dayPlacesByGroupId"] = { main: [] };
  for (const row of rows) {
    const bucket = dayPlacesByGroupId[row.groupId] ?? [];
    bucket.push({
      date: row.date,
      primaryCity: "Tokyo",
      secondaryCity: null,
      primaryShare: 1,
      dayType: "trip",
      includeBuffer: false,
    });
    dayPlacesByGroupId[row.groupId] = bucket;
  }
  return {
    tripId: "trip",
    basics: {
      name: "Japan",
      schoolName: "School",
      startDate: "2026-07-01",
      endDate: "2026-07-14",
      timezone: "Asia/Tokyo",
      departureCity: "Christchurch",
      returnCity: "Christchurch",
      defaultDepartureAirport: "",
      destinationCountries: ["Japan"],
    },
    mainGroupId: "main",
    groups: [{ id: "main", name: "Main", sortOrder: 0, isMain: true }],
    dayPlacesByGroupId,
    outboundLegs: [],
    returnLegs: [],
    intercityLegs: [],
    accommodationStays: [],
    activities: [],
    overlayOps: [],
    transportProducts: [],
    hiddenPendingTransportNeedKeys: [],
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
  };
}

describe("slimGraphPayloadForEngine", () => {
  it("drops off-grid day-place rows and dedupes by date per group", () => {
    const graph = graphWithDayPlaces([
      { groupId: "main", date: "2026-07-01" },
      { groupId: "main", date: "2026-07-01" },
      { groupId: "main", date: "2099-01-01" },
      { groupId: "main", date: "2020-01-01" },
    ]);
    const slim = slimGraphPayloadForEngine(graph);
    assert.equal(slim.dayPlacesByGroupId.main.length, 1);
    assert.equal(slim.dayPlacesByGroupId.main[0]!.date, "2026-07-01");
  });
});
