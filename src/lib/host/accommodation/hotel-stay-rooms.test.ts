import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { setupStateToGraph } from "@/lib/trip-engine/adapters";
import type { TripSetupState } from "@/lib/host/setup/types";

import {
  assignedRoomNameByParticipantAtStay,
  eligibleStudentsForStay,
  groupStayRoomAssignments,
  hotelNameMatchesStay,
} from "./hotel-stay-rooms";

function baseState(): TripSetupState {
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
    groups: [{ id: "main-group", name: "Everyone", type: "main", description: null, sortOrder: 0, isMain: true }],
    dayPlacesByGroupId: {
      "main-group": [
        { date: "2026-12-13", primaryCity: "Hiroshima", dayType: "trip" },
        { date: "2026-12-14", primaryCity: "Hiroshima", dayType: "trip" },
      ],
    },
    outboundLegs: [],
    returnLegs: [],
    intercityLegs: [],
    accommodationStays: [],
    activities: [],
    overlayOps: [],
  };
}

describe("hotelNameMatchesStay", () => {
  it("matches room hotel label to stay name", () => {
    assert.equal(
      hotelNameMatchesStay("The Knot", { name: "The Knot", cityLabel: "Hiroshima" }),
      true,
    );
  });
});

describe("eligibleStudentsForStay", () => {
  it("only includes students present on the calendar during the stay", () => {
    const graph = setupStateToGraph("trip-1", {
      ...baseState(),
      dayPlacesByGroupId: {
        "main-group": [
          { date: "2026-12-13", primaryCity: "Hiroshima", dayType: "trip" },
          { date: "2026-12-14", primaryCity: "Hiroshima", dayType: "trip" },
          { date: "2026-12-16", primaryCity: "Kyoto", dayType: "trip" },
          { date: "2026-12-17", primaryCity: "Kyoto", dayType: "trip" },
        ],
      },
    });
    const roster = {
      participants: [
        {
          id: "p-adri",
          fullName: "Adri",
          role: "student" as const,
          groupIds: ["main-group"],
          inCostSplit: true,
          roomId: null,
        },
        {
          id: "p-mia",
          fullName: "Mia",
          role: "student" as const,
          groupIds: ["main-group"],
          inCostSplit: true,
          roomId: null,
        },
      ],
      groups: graph.groups,
      rooms: [],
    };

    const hiroshimaStay = {
      id: "stay-hiroshima",
      name: "The Knot",
      cityLabel: "Hiroshima",
      checkInDate: "2026-12-13",
      checkOutDate: "2026-12-15",
    };
    const kyotoStay = {
      id: "stay-kyoto",
      name: "Hotel New Hankyu Kyoto",
      cityLabel: "Kyoto",
      checkInDate: "2026-12-16",
      checkOutDate: "2026-12-18",
    };

    assert.deepEqual(
      eligibleStudentsForStay(graph, roster, hiroshimaStay).map((p) => p.fullName),
      ["Adri", "Mia"],
    );
    assert.deepEqual(
      eligibleStudentsForStay(graph, roster, kyotoStay).map((p) => p.fullName),
      ["Adri", "Mia"],
    );
  });
});

describe("groupStayRoomAssignments", () => {
  it("groups participants by room for one stay only", () => {
    const roster = {
      participants: [
        { id: "p-1", fullName: "Finley", role: "student" as const, groupIds: [], inCostSplit: true, roomId: null },
        { id: "p-2", fullName: "Toby", role: "student" as const, groupIds: [], inCostSplit: true, roomId: null },
      ],
      groups: [],
      rooms: [{ id: "room-1", roomName: "Boys 1", hotelName: "The Knot", hotelAddress: null, nearestStation: null, notes: null }],
    };
    const grouped = groupStayRoomAssignments(
      [
        {
          id: "a-1",
          stayId: "stay-hiroshima",
          stayName: "The Knot",
          stayCityLabel: "Hiroshima",
          participantId: "p-1",
          participantName: "Finley",
          groupId: null,
          groupName: null,
          roomId: "room-1",
          roomName: "Boys 1",
          startDate: "2026-12-13",
          endDate: "2026-12-15",
        },
        {
          id: "a-2",
          stayId: "stay-tokyo",
          stayName: "Villa Fontaine",
          stayCityLabel: "Tokyo",
          participantId: "p-2",
          participantName: "Toby",
          groupId: null,
          groupName: null,
          roomId: "room-2",
          roomName: "Boys 1",
          startDate: "2026-12-05",
          endDate: "2026-12-06",
        },
      ],
      "stay-hiroshima",
      roster,
    );

    assert.equal(grouped.length, 1);
    assert.deepEqual(grouped[0]?.participantIds, ["p-1"]);
    assert.equal(assignedRoomNameByParticipantAtStay(
      [
        {
          id: "a-1",
          stayId: "stay-hiroshima",
          stayName: "The Knot",
          stayCityLabel: "Hiroshima",
          participantId: "p-1",
          participantName: "Finley",
          groupId: null,
          groupName: null,
          roomId: "room-1",
          roomName: "Boys 1",
          startDate: "2026-12-13",
          endDate: "2026-12-15",
        },
      ],
      "stay-hiroshima",
    ).get("p-1"), "Boys 1");
  });
});
