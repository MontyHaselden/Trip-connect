import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildStayPropagationCommands,
  findStayPropagationCandidates,
} from "./stay-propagation-candidates";
import type { TripEntityGraph } from "./types";

function baseGraph(): TripEntityGraph {
  return {
    tripId: "trip-1",
    mainGroupId: "main",
    groups: [
      { id: "main", name: "Main", type: "whole_group", isMain: true, sortOrder: 0 },
      {
        id: "personal-amanda",
        name: "Amanda",
        type: "personal",
        isMain: false,
        sortOrder: 1,
        personalForParticipantId: "p-amanda",
        inheritMode: "overlay",
      },
      {
        id: "personal-macy",
        name: "Macy",
        type: "personal",
        isMain: false,
        sortOrder: 2,
        personalForParticipantId: "p-macy",
        inheritMode: "overlay",
      },
    ],
    dayPlacesByGroupId: {
      main: [
        {
          date: "2026-12-05",
          primaryCity: "Christchurch",
          secondaryCity: "Tokyo",
          primaryShare: 0.5,
          dayType: "travel",
          includeBuffer: false,
        },
        {
          date: "2026-12-06",
          primaryCity: "Tokyo",
          secondaryCity: null,
          primaryShare: 1,
          dayType: "trip",
          includeBuffer: false,
        },
        {
          date: "2026-12-08",
          primaryCity: "Kagoshima",
          secondaryCity: null,
          primaryShare: 1,
          dayType: "trip",
          includeBuffer: false,
        },
      ],
      "personal-amanda": [
        {
          date: "2026-12-05",
          primaryCity: "Tottori",
          secondaryCity: null,
          primaryShare: 1,
          dayType: "trip",
          includeBuffer: false,
        },
      ],
      "personal-macy": [],
    },
    accommodationStays: [
      {
        id: "stay-main",
        cityLabel: "Tokyo",
        stayType: "hotel",
        name: "Hotel Villa Fontaine",
        url: null,
        address: null,
        phone: null,
        checkInDate: "2026-12-05",
        checkOutDate: "2026-12-07",
        notes: null,
        isHomestayGroup: false,
        multipleInCity: false,
        originGroupId: "main",
      },
      {
        id: "stay-macy",
        cityLabel: "Macys home",
        stayType: "homestay",
        name: "Macys home",
        url: null,
        address: null,
        phone: null,
        checkInDate: "2026-12-08",
        checkOutDate: "2026-12-10",
        notes: null,
        isHomestayGroup: false,
        multipleInCity: false,
        originGroupId: "personal-macy",
      },
    ],
    outboundLegs: [],
    returnLegs: [],
    intercityLegs: [],
    activities: [],
    overlayOps: [],
    basics: {
      name: "Japan",
      schoolName: "School",
      startDate: "2026-12-05",
      endDate: "2026-12-22",
      timezone: "Asia/Tokyo",
      departureCity: "Christchurch",
      returnCity: "Christchurch",
      defaultDepartureAirport: "",
      destinationCountries: ["Japan"],
    },
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

const roster = {
  participants: [
    {
      id: "p-amanda",
      fullName: "Amanda Smith",
      role: "student" as const,
      inCostSplit: true,
      groupIds: ["main"],
    },
    {
      id: "p-macy",
      fullName: "Macy Jones",
      role: "student" as const,
      inCostSplit: true,
      groupIds: ["main"],
    },
  ],
  groups: [],
  rooms: [],
};

describe("findStayPropagationCandidates", () => {
  it("includes overlay participants on trip during the stay, not later joiners", () => {
    const candidates = findStayPropagationCandidates(
      baseGraph(),
      roster,
      { checkIn: "2026-12-05", checkOut: "2026-12-07" },
      "Tokyo",
    );
    assert.equal(candidates.length, 1);
    assert.equal(candidates[0]?.participantId, "p-amanda");
  });
});

describe("buildStayPropagationCommands", () => {
  it("clears personal overlay days and overlapping personal stays", () => {
    const commands = buildStayPropagationCommands(
      baseGraph(),
      { checkIn: "2026-12-05", checkOut: "2026-12-07" },
      ["personal-amanda"],
    );
    assert.deepEqual(commands, [
      { type: "setDayPlaces", groupId: "personal-amanda", days: [] },
    ]);
  });
});
