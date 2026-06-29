import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { setupStateToGraph } from "./adapters";
import { applyCommands } from "./apply-commands";
import { expandCommandsForCalendarLens } from "./calendar-lens-dispatch";
import { coerceUnknownGroupCommandsToMain } from "./command-group-ids";
import { pruneStalePersonalTransportLegs } from "./prune-stale-personal-transport-legs";
import type { RosterSummary, TripEntityGraph } from "./types";

function partyGraph(): TripEntityGraph {
  return setupStateToGraph("trip-1", {
    basics: {
      name: "Japan 2026",
      schoolName: "",
      startDate: "2026-12-05",
      endDate: "2026-12-21",
      timezone: "Asia/Tokyo",
      departureCity: "Christchurch",
      returnCity: "Christchurch",
      defaultDepartureAirport: "",
      destinationCountries: ["Japan"],
    },
    mainGroupId: "g-main",
    groups: [
      {
        id: "g-main",
        name: "Main",
        type: "main",
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
      {
        id: "g-mia",
        name: "Mia",
        type: "split_travel",
        description: null,
        sortOrder: 3,
        isMain: false,
        inheritMode: "overlay",
        personalForParticipantId: "p-mia",
      },
      {
        id: "g-trenuela",
        name: "Trenuela",
        type: "split_travel",
        description: null,
        sortOrder: 4,
        isMain: false,
        inheritMode: "overlay",
        personalForParticipantId: "p-trenuela",
      },
    ],
    dayPlacesByGroupId: {
      "g-main": [
        {
          date: "2026-12-06",
          primaryCity: "Kagoshima",
          secondaryCity: null,
          primaryShare: 1,
          dayType: "trip",
          includeBuffer: false,
        },
        {
          date: "2026-12-07",
          primaryCity: "Kagoshima",
          secondaryCity: null,
          primaryShare: 1,
          dayType: "trip",
          includeBuffer: false,
        },
      ],
      "g-amanda": [],
      "g-kaleb": [],
      "g-mia": [],
      "g-trenuela": [],
    },
    outboundLegs: [],
    returnLegs: [],
    intercityLegs: [
      {
        id: "leg-amanda-tottori",
        transportType: "train",
        bookingStatus: "not_booked",
        travelDate: "2026-12-07",
        arrivalDate: null,
        departureTime: null,
        arrivalTime: null,
        fromCity: "Tokyo",
        toCity: "Tottori",
        fromStation: null,
        toStation: null,
        operator: null,
        referenceNumber: null,
        flightNumber: null,
        notes: null,
        intercityFromCity: "Tokyo",
        intercityToCity: "Tottori",
        originGroupId: "g-amanda",
      },
    ],
    accommodationStays: [],
    activities: [],
    overlayOps: [],
  });
}

function partyRoster(): RosterSummary {
  return {
    participants: [
      { id: "p-amanda", fullName: "Amanda", role: "student", groupIds: ["g-main"], roomId: null, inCostSplit: true },
      { id: "p-kaleb", fullName: "Kaleb", role: "student", groupIds: ["g-main"], roomId: null, inCostSplit: true },
      { id: "p-mia", fullName: "Mia", role: "student", groupIds: ["g-main"], roomId: null, inCostSplit: true },
      { id: "p-trenuela", fullName: "Trenuela", role: "student", groupIds: ["g-main"], roomId: null, inCostSplit: true },
    ],
    groups: [],
    rooms: [],
  };
}

describe("party batch calendar persist", () => {
  it("party fan-out paintDayRange updates every personal overlay", () => {
    const graph = partyGraph();
    const roster = partyRoster();
    const commands = expandCommandsForCalendarLens(
      [
        {
          type: "paintDayRange",
          groupId: "g-amanda",
          rangeStart: "2026-12-06",
          rangeEnd: "2026-12-07",
          location: "Tottori",
        },
      ],
      {
        kind: "party",
        participantIds: ["p-amanda", "p-kaleb", "p-mia", "p-trenuela"],
      },
      graph,
      roster,
    );

    assert.equal(commands.length, 4);
    const result = applyCommands(graph, commands).graph;

    for (const groupId of ["g-amanda", "g-kaleb", "g-mia", "g-trenuela"]) {
      const overlay = result.dayPlacesByGroupId[groupId] ?? [];
      const dec6 = overlay.find((day) => day.date === "2026-12-06");
      const dec7 = overlay.find((day) => day.date === "2026-12-07");
      assert.ok(
        dec6 &&
          (dec6.primaryCity === "Tottori" ||
            dec6.secondaryCity === "Tottori"),
        `expected Tottori on Dec 6 for ${groupId}`,
      );
      assert.equal(dec7?.primaryCity, "Tottori", `expected full Tottori on Dec 7 for ${groupId}`);
    }
  });

  it("coerces unknown group id to the main group", () => {
    const graph = partyGraph();
    const [command] = coerceUnknownGroupCommandsToMain(
      [
        {
          type: "paintDayRange",
          groupId: "missing-personal-group",
          rangeStart: "2026-12-06",
          rangeEnd: "2026-12-07",
          location: "Tottori",
        },
      ],
      graph,
    );
    assert.equal(command.groupId, graph.mainGroupId);
  });
});

describe("pruneStalePersonalTransportLegs", () => {
  it("removes personal intercity legs that no longer match calendar cities", () => {
    const graph = partyGraph();
    const painted = applyCommands(graph, [
      {
        type: "paintDayRange",
        groupId: "g-amanda",
        rangeStart: "2026-12-06",
        rangeEnd: "2026-12-07",
        location: "Kagoshima",
      },
    ]).graph;

    const pruned = pruneStalePersonalTransportLegs(painted, "g-amanda");
    assert.equal(
      pruned.intercityLegs.some((leg) => leg.id === "leg-amanda-tottori"),
      false,
    );
  });
});
