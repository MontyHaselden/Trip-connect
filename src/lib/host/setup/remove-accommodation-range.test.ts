import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  removeAccommodationAndCitiesFromRange,
  splitStaysForRangeRemoval,
} from "./remove-accommodation-range";
import type { TripSetupState } from "./types";
function baseState(): TripSetupState {
  const mainGroupId = "main";
  return {
    basics: {
      name: "Trip",
      startDate: "2026-08-23",
      endDate: "2026-09-01",
      departureCity: "London",
      returnCity: "London",
      destinationCountries: ["Thailand"],
      timezone: "Europe/London",
    },
    mainGroupId,
    groups: [{ id: mainGroupId, name: "Main", type: "main", description: null, sortOrder: 0, isMain: true }],
    dayPlacesByGroupId: {
      main: [
        { date: "2026-08-24", primaryCity: "Patong", secondaryCity: null, primaryShare: 1, dayType: "trip", includeBuffer: false },
        { date: "2026-08-25", primaryCity: "Patong", secondaryCity: null, primaryShare: 1, dayType: "trip", includeBuffer: false },
        { date: "2026-08-26", primaryCity: "Patong", secondaryCity: null, primaryShare: 1, dayType: "trip", includeBuffer: false },
        { date: "2026-08-27", primaryCity: "Patong", secondaryCity: null, primaryShare: 1, dayType: "trip", includeBuffer: false },
        { date: "2026-08-28", primaryCity: "Patong", secondaryCity: null, primaryShare: 1, dayType: "trip", includeBuffer: false },
      ],
    },
    outboundLegs: [],
    returnLegs: [],
    intercityLegs: [],
    accommodationStays: [
      {
        id: "stay-1",
        cityLabel: "Patong",
        stayType: "hotel",
        name: "Royal Paradise",
        url: null,
        address: null,
        phone: null,
        checkInDate: "2026-08-23",
        checkOutDate: "2026-09-01",
        notes: null,
        isHomestayGroup: false,
        multipleInCity: false,
        originGroupId: mainGroupId,
      },
    ],
    activities: [],
    overlayOps: [],
  };
}

describe("splitStaysForRangeRemoval", () => {
  it("splits a stay when deleting middle nights", () => {
    const stays = baseState().accommodationStays;
    const next = splitStaysForRangeRemoval(stays, "2026-08-25", "2026-08-27");
    assert.equal(next.length, 2);
    assert.equal(next[0]?.checkInDate, "2026-08-23");
    assert.equal(next[0]?.checkOutDate, "2026-08-25");
    assert.equal(next[1]?.checkInDate, "2026-08-28");
    assert.equal(next[1]?.checkOutDate, "2026-09-01");
  });
});

describe("removeAccommodationAndCitiesFromRange", () => {
  it("creates thin edges on boundary days and removes middle nights", () => {
    const state = baseState();
    const next = removeAccommodationAndCitiesFromRange(
      state,
      "2026-08-25",
      "2026-08-27",
      state.mainGroupId,
    );

    assert.equal(next.accommodationStays.length, 2);
    const days = next.dayPlacesByGroupId.main ?? [];
    const aug25 = days.find((d) => d.date === "2026-08-25");
    const aug27 = days.find((d) => d.date === "2026-08-27");
    const aug26 = days.find((d) => d.date === "2026-08-26");

    assert.equal(aug25?.primaryCity, "Patong");
    assert.equal(aug25?.primaryShare, 0.5);
    assert.equal(aug25?.secondaryCity, null);
    assert.equal(aug27?.secondaryCity, "Patong");
    assert.equal(aug27?.primaryShare, 0.5);
    assert.equal(aug26, undefined);
  });

  it("removes a stay entirely when range covers all nights", () => {
    const state = baseState();
    state.accommodationStays = [
      {
        ...state.accommodationStays[0]!,
        checkInDate: "2026-08-25",
        checkOutDate: "2026-08-28",
      },
    ];
    const next = removeAccommodationAndCitiesFromRange(
      state,
      "2026-08-25",
      "2026-08-27",
      state.mainGroupId,
    );
    assert.equal(next.accommodationStays.length, 0);
  });
});
