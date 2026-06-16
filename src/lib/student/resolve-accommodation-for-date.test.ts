import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { filterSnapshotForParticipantV1 } from "@/lib/publish/filter-for-participant";
import { resolveAccommodationForDate } from "./resolve-accommodation-for-date";
import type { PublishedTripSnapshotV1 } from "@/types/published-trip";

const baseSnapshot: PublishedTripSnapshotV1 = {
  version: 1,
  publishedAt: new Date().toISOString(),
  trip: {
    id: "trip1",
    name: "Japan",
    schoolName: "School",
    startDate: "2026-12-01",
    endDate: "2026-12-10",
    destinationCountry: "JP",
    destinationLanguage: "ja",
    timezone: "Asia/Tokyo",
    publishedVersion: 1,
  },
  days: [],
  itineraryItems: [],
  tomorrowPrepItems: [],
  contacts: [],
  participants: [
    {
      id: "p1",
      fullName: "Alex",
      phoneNumberE164: "+640000",
      role: "student",
    },
  ],
  groups: [{ id: "g1", name: "Kagoshima", type: "route", description: null, sortOrder: 1 }],
  participantGroups: [{ participantId: "p1", groupId: "g1" }],
  rooms: [],
  participantRooms: [],
  phraseCategories: [],
  phrases: [],
  accommodationStays: [
    {
      id: "stay-all",
      cityLabel: "Tokyo",
      stayType: "hotel",
      name: "Everyone Hotel",
      address: "Tokyo",
      checkInDate: "2026-12-01",
      checkOutDate: "2026-12-10",
      visibilityMode: "everyone",
      audienceType: "everyone",
      audienceId: null,
    },
  ],
  accommodationAssignments: [
    {
      id: "a1",
      stayId: "stay-h",
      participantId: "p1",
      groupId: null,
      roomId: null,
      startDate: "2026-12-05",
      endDate: "2026-12-05",
      stayName: "Homestay Tanaka",
      stayAddress: "Kagoshima",
      stayPhone: "+81",
      stayType: "homestay",
      cityLabel: "Kagoshima",
    },
  ],
};

describe("resolveAccommodationForDate", () => {
  it("prefers individual assignment over everyone stay", () => {
    const acc = resolveAccommodationForDate(baseSnapshot, "p1", "2026-12-05");
    assert.equal(acc?.name, "Homestay Tanaka");
  });

  it("falls back to everyone stay when no assignment", () => {
    const acc = resolveAccommodationForDate(baseSnapshot, "p1", "2026-12-02");
    assert.equal(acc?.name, "Everyone Hotel");
  });

  it("works with participant-filtered student payload", () => {
    const filtered = filterSnapshotForParticipantV1(baseSnapshot, "p1");
    const acc = resolveAccommodationForDate(filtered, "p1", "2026-12-02");
    assert.equal(acc?.name, "Everyone Hotel");
  });
});
