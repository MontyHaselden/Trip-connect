import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveLayersForParticipant } from "./resolve-layers";
import type { PublishedTripSnapshotV1 } from "@/types/published-trip";

function baseSnapshot(): PublishedTripSnapshotV1 {
  return {
    version: 1,
    publishedAt: new Date().toISOString(),
    trip: {
      id: "trip-1",
      name: "Japan",
      schoolName: "School",
      startDate: "2026-06-01",
      endDate: "2026-06-21",
      destinationCountry: "Japan",
      destinationLanguage: null,
      timezone: "Asia/Tokyo",
      publishedVersion: 1,
    },
    days: [
      {
        id: "day-tokyo",
        date: "2026-06-15",
        cityLabel: "Tokyo",
        calendarLabel: null,
        summary: null,
        sortOrder: 0,
      },
      {
        id: "day-oita",
        date: "2026-06-16",
        cityLabel: "Tokyo",
        calendarLabel: null,
        summary: null,
        sortOrder: 1,
      },
    ],
    groups: [
      {
        id: "main-g",
        name: "Main Group",
        type: "other",
        description: null,
        sortOrder: 0,
        isMain: true,
      },
      {
        id: "group-b",
        name: "Group B",
        type: "split_travel",
        description: null,
        sortOrder: 1,
        isMain: false,
      },
    ],
    participants: [
      {
        id: "p-main",
        fullName: "Main Student",
        phoneNumberE164: "+64111111111",
        role: "student",
      },
      {
        id: "p-b",
        fullName: "Group B Student",
        phoneNumberE164: "+64222222222",
        role: "student",
      },
    ],
    participantGroups: [
      { participantId: "p-main", groupId: "main-g" },
      { participantId: "p-b", groupId: "group-b" },
    ],
    participantRooms: [],
    groupDayPlaces: [
      {
        id: "gdp-main-16",
        groupId: "main-g",
        date: "2026-06-16",
        primaryCity: "Tokyo",
        secondaryCity: null,
        primaryShare: 1,
        dayType: "trip",
        calendarLabel: null,
        weatherLocationQuery: null,
      },
      {
        id: "gdp-b-16",
        groupId: "group-b",
        date: "2026-06-16",
        primaryCity: "Oita",
        secondaryCity: null,
        primaryShare: 1,
        dayType: "trip",
        calendarLabel: null,
        weatherLocationQuery: null,
      },
    ],
    groupOverlayOps: [],
    accommodationStays: [
      {
        id: "stay-tokyo",
        originGroupId: "main-g",
        sourceEntityId: null,
        cityLabel: "Tokyo",
        stayType: "hotel",
        name: "Tokyo Hotel",
        address: null,
        checkInDate: "2026-06-01",
        checkOutDate: "2026-06-21",
        visibilityMode: "everyone",
        audienceType: "everyone",
        audienceId: null,
      },
      {
        id: "stay-oita",
        originGroupId: "group-b",
        sourceEntityId: null,
        cityLabel: "Oita",
        stayType: "hotel",
        name: "Oita Hotel",
        address: null,
        checkInDate: "2026-06-16",
        checkOutDate: "2026-06-21",
        visibilityMode: "everyone",
        audienceType: "everyone",
        audienceId: null,
      },
    ],
    accommodationAssignments: [],
    transportLegs: [],
    visibilityTargets: [],
    itineraryItems: [],
    tomorrowPrepItems: [],
    contacts: [],
    rooms: [],
    phraseCategories: [],
    phrases: [],
  };
}

describe("resolveLayersForParticipant", () => {
  it("Group B student sees Oita on overridden day", () => {
    const snapshot = baseSnapshot();
    const resolved = resolveLayersForParticipant(snapshot, "p-b");
    const day = resolved.days.find((d) => d.date === "2026-06-16");
    assert.equal(day?.cityLabel, "Oita");
  });

  it("Main-only student keeps Tokyo on all days", () => {
    const snapshot = baseSnapshot();
    const resolved = resolveLayersForParticipant(snapshot, "p-main");
    const day = resolved.days.find((d) => d.date === "2026-06-16");
    assert.equal(day?.cityLabel, "Tokyo");
  });

  it("hide overlay removes main stay for group B", () => {
    const snapshot = baseSnapshot();
    snapshot.groupOverlayOps = [
      {
        id: "op-1",
        groupId: "group-b",
        entityType: "accommodation_stay",
        baseEntityId: "stay-tokyo",
        op: "hide",
        replacementEntityId: null,
        effectiveFrom: "2026-06-16",
        effectiveTo: "2026-06-21",
      },
    ];
    const resolved = resolveLayersForParticipant(snapshot, "p-b");
    const ids = (resolved.accommodationStays ?? []).map((s) => s.id);
    assert.equal(ids.includes("stay-tokyo"), false);
    assert.equal(ids.includes("stay-oita"), true);
  });
});
