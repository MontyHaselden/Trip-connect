import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { RosterSummary, TripEntityGraph } from "./types";

import {
  calendarLensScopeGroupIds,
  editGroupIdForLens,
  lensDisplayLabel,
  normalizeCalendarLens,
  partyPersonalGroupIds,
  transportViewGroupIdForLens,
} from "./person-lens";

function graph(): TripEntityGraph {
  return {
    tripId: "trip-1",
    mainGroupId: "main",
    basics: {
      name: "Japan",
      schoolName: "School",
      startDate: "2026-12-05",
      endDate: "2026-12-21",
      timezone: "Pacific/Auckland",
      departureCity: "Christchurch",
      returnCity: "Christchurch",
      defaultDepartureAirport: null,
      destinationCountries: ["Japan"],
    },
    groups: [
      {
        id: "main",
        name: "Main",
        type: "whole_group",
        description: null,
        sortOrder: 0,
        isMain: true,
        inheritMode: null,
        personalForParticipantId: null,
      },
      {
        id: "g-tottori",
        name: "Tottori side trip",
        type: "split_travel",
        description: null,
        sortOrder: 1,
        isMain: false,
        inheritMode: null,
        personalForParticipantId: null,
      },
      {
        id: "g-amanda",
        name: "Amanda",
        type: "split_travel",
        description: null,
        sortOrder: 2,
        isMain: false,
        inheritMode: "overlay",
        personalForParticipantId: "p-amanda",
      },
    ],
    dayPlacesByGroupId: {},
    accommodationStays: [],
    outboundLegs: [],
    returnLegs: [],
    intercityLegs: [],
    activities: [],
    overlayOps: [],
    bookingsSummary: [],
    emergencySummary: { localEmergencyNumber: null, schoolEmergencyPhone: null },
    publishSummary: { viewerGalleryEnabled: true, viewerRoomDetailsEnabled: true },
  };
}

function roster(): RosterSummary {
  return {
    participants: [
      {
        id: "p-amanda",
        fullName: "Amanda",
        role: "student",
        groupIds: ["main", "g-tottori"],
        roomId: null,
        inCostSplit: true,
      },
      {
        id: "p-kaleb",
        fullName: "Kaleb",
        role: "student",
        groupIds: ["main"],
        roomId: null,
        inCostSplit: true,
      },
    ],
    groups: [],
    rooms: [],
  };
}

describe("calendar lens helpers", () => {
  it("uses subgroup id for subgroup lens", () => {
    const lens = { kind: "subgroup" as const, groupId: "g-tottori" };
    assert.equal(editGroupIdForLens(graph(), lens, roster()), "g-tottori");
    assert.deepEqual(calendarLensScopeGroupIds(lens, graph(), roster()), ["g-tottori"]);
  });

  it("uses first party personal group for calendar edit id", () => {
    const g = graph();
    g.groups.push({
      id: "g-kaleb",
      name: "Kaleb",
      type: "split_travel",
      description: null,
      sortOrder: 3,
      isMain: false,
      inheritMode: "overlay",
      personalForParticipantId: "p-kaleb",
    });
    const lens = { kind: "party" as const, participantIds: ["p-kaleb", "p-amanda"] };
    assert.equal(editGroupIdForLens(g, lens, roster()), "g-amanda");
    assert.deepEqual(partyPersonalGroupIds(g, lens.participantIds).sort(), [
      "g-amanda",
      "g-kaleb",
    ]);
    assert.equal(transportViewGroupIdForLens(g, lens, roster()), "main");
  });

  it("labels party lens with Oxford comma", () => {
    const label = lensDisplayLabel(
      { kind: "party", participantIds: ["p-amanda", "p-kaleb"] },
      graph(),
      roster(),
    );
    assert.equal(label, "Amanda & Kaleb");
  });

  it("normalizes single-party selection to person lens", () => {
    assert.deepEqual(
      normalizeCalendarLens({ kind: "party", participantIds: ["p-amanda"] }, graph(), roster()),
      { kind: "person", participantId: "p-amanda" },
    );
  });
});
