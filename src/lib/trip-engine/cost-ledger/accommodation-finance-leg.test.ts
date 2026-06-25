import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  duplicatePersonalStayIdsForFinance,
  financeSeedAccommodationStays,
  isSameFinanceAccommodationLeg,
} from "./accommodation-finance-leg";
import type { TripEntityGraph } from "../types";

function graphWithStays(
  stays: TripEntityGraph["accommodationStays"],
): TripEntityGraph {
  return {
    tripId: "trip-1",
    mainGroupId: "main",
    groups: [],
    dayPlacesByGroupId: {},
    accommodationStays: stays,
    activities: [],
    outboundLegs: [],
    returnLegs: [],
    intercityLegs: [],
    overlayOps: [],
    bookingsSummary: [],
    emergencySummary: {
      localEmergencyNumber: null,
      schoolEmergencyNumber: null,
      contactsCount: 0,
      phrasesCount: 0,
    },
    publishSummary: {
      publishedVersion: 0,
      viewerGalleryEnabled: false,
      viewerRoomDetailsEnabled: false,
    },
    basics: {
      name: "Trip",
      schoolName: "School",
      startDate: "2026-12-06",
      endDate: "2026-12-20",
      timezone: "Asia/Tokyo",
      departureCity: "",
      returnCity: "",
      defaultDepartureAirport: null,
      destinationCountries: [],
    },
  } as TripEntityGraph;
}

describe("accommodation-finance-leg", () => {
  it("treats same hotel + city + overlapping dates as one leg", () => {
    const main = {
      id: "stay-main",
      name: "Grand Prince Hotel Shin Takanawa",
      cityLabel: "Tokyo",
      checkInDate: "2026-12-17",
      checkOutDate: "2026-12-21",
      originGroupId: "main",
    };
    const personal = {
      id: "stay-macy",
      name: "Grand Prince Hotel Shin Takanawa",
      cityLabel: "Tokyo",
      checkInDate: "2026-12-18",
      checkOutDate: "2026-12-23",
      originGroupId: "g-macy",
    };
    assert.ok(isSameFinanceAccommodationLeg(main, personal));
  });

  it("does not seed a second finance row for personal duplicate of main leg", () => {
    const graph = graphWithStays([
      {
        id: "stay-main",
        groupId: "main",
        name: "Grand Prince Hotel Shin Takanawa",
        cityLabel: "Tokyo",
        stayType: "hotel",
        checkInDate: "2026-12-17",
        checkOutDate: "2026-12-21",
        originGroupId: "main",
      },
      {
        id: "stay-macy",
        groupId: "g-macy",
        name: "Grand Prince Hotel Shin Takanawa",
        cityLabel: "Tokyo",
        stayType: "hotel",
        checkInDate: "2026-12-18",
        checkOutDate: "2026-12-23",
        originGroupId: "g-macy",
      },
    ] as TripEntityGraph["accommodationStays"]);

    const seeds = financeSeedAccommodationStays(graph);
    assert.equal(seeds.length, 1);
    assert.equal(seeds[0]?.id, "stay-main");
    assert.equal(duplicatePersonalStayIdsForFinance(graph).has("stay-macy"), true);
  });

  it("still seeds personal-only hotel when main group has no matching leg", () => {
    const graph = graphWithStays([
      {
        id: "stay-macy",
        groupId: "g-macy",
        name: "Macy Homestay",
        cityLabel: "Oita",
        stayType: "homestay",
        checkInDate: "2026-12-18",
        checkOutDate: "2026-12-23",
        originGroupId: "g-macy",
      },
    ] as TripEntityGraph["accommodationStays"]);

    assert.equal(financeSeedAccommodationStays(graph).length, 1);
    assert.equal(duplicatePersonalStayIdsForFinance(graph).size, 0);
  });
});
