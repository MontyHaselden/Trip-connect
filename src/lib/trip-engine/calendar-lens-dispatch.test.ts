import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { TripCommand } from "./commands";
import type { RosterSummary, TripEntityGraph } from "./types";

import { expandCommandsForCalendarLens } from "./calendar-lens-dispatch";

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
        id: "g-amanda",
        name: "Amanda",
        type: "split_travel",
        description: null,
        sortOrder: 1,
        isMain: false,
        inheritMode: "overlay",
        personalForParticipantId: "p-amanda",
      },
      {
        id: "g-kaleb",
        name: "Kaleb",
        type: "split_travel",
        description: null,
        sortOrder: 2,
        isMain: false,
        inheritMode: "overlay",
        personalForParticipantId: "p-kaleb",
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
        groupIds: ["main"],
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

describe("expandCommandsForCalendarLens", () => {
  it("fans paint commands to every party personal group", () => {
    const commands: TripCommand[] = [
      {
        type: "paintDayRange",
        groupId: "g-amanda",
        startDate: "2026-12-06",
        endDate: "2026-12-11",
        primaryCity: "Tottori",
        replan: false,
      },
    ];

    const expanded = expandCommandsForCalendarLens(
      commands,
      { kind: "party", participantIds: ["p-amanda", "p-kaleb"] },
      graph(),
      roster(),
    );

    assert.equal(expanded.length, 2);
    assert.deepEqual(
      expanded.map((c) => ("groupId" in c ? c.groupId : null)).sort(),
      ["g-amanda", "g-kaleb"],
    );
  });

  it("leaves whole-group commands unchanged", () => {
    const commands: TripCommand[] = [
      {
        type: "paintDayRange",
        groupId: "main",
        startDate: "2026-12-06",
        endDate: "2026-12-11",
        primaryCity: "Tokyo",
        replan: false,
      },
    ];

    const expanded = expandCommandsForCalendarLens(
      commands,
      { kind: "party", participantIds: ["p-amanda", "p-kaleb"] },
      graph(),
      roster(),
    );

    assert.equal(expanded.length, 1);
    assert.equal(expanded[0]?.type, "paintDayRange");
  });

  it("does not fan out batched transport leg adds", () => {
    const commands: TripCommand[] = [
      {
        type: "addClassifiedTransportLegs",
        groupId: "g-amanda",
        legs: [],
      },
      {
        type: "addClassifiedTransportLegs",
        groupId: "g-kaleb",
        legs: [],
      },
    ];

    const expanded = expandCommandsForCalendarLens(
      commands,
      { kind: "party", participantIds: ["p-amanda", "p-kaleb"] },
      graph(),
      roster(),
    );

    assert.equal(expanded.length, 2);
  });
});
