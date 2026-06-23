import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  removeAccommodationAndCitiesFromRange,
  splitStaysForRangeRemoval,
  trimConflictingStaysForLocationPaint,
} from "./remove-accommodation-range";
import { clearCalendarContentInRange } from "./clear-day-content";
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

describe("trimConflictingStaysForLocationPaint", () => {
  it("shortens a stay that overlaps a new city paint", () => {
    const stays = [
      {
        ...baseState().accommodationStays[0]!,
        checkInDate: "2026-07-06",
        checkOutDate: "2026-07-13",
        cityLabel: "Bangkok",
        name: "Centre Point Plus",
      },
    ];
    const next = trimConflictingStaysForLocationPaint(
      stays,
      "Paris, France",
      "2026-07-10",
      "2026-07-16",
    );
    assert.equal(next.length, 1);
    assert.equal(next[0]?.checkOutDate, "2026-07-10");
  });

  it("leaves same-city stays untouched", () => {
    const stays = baseState().accommodationStays;
    const next = trimConflictingStaysForLocationPaint(stays, "Patong", "2026-08-25", "2026-08-27");
    assert.deepEqual(next, stays);
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

  it("clears host-painted Paris through checkout without leaving spill days", () => {
    const state = baseState();
    state.basics.startDate = "2026-07-01";
    state.basics.endDate = "2026-07-20";
    state.accommodationStays = [];
    state.dayPlacesByGroupId.main = [
      { date: "2026-07-10", primaryCity: "Bangkok", secondaryCity: "Paris, France", primaryShare: 0.5, dayType: "travel", includeBuffer: false },
      { date: "2026-07-11", primaryCity: "Paris, France", secondaryCity: null, primaryShare: 1, dayType: "trip", includeBuffer: false },
      { date: "2026-07-12", primaryCity: "Paris, France", secondaryCity: null, primaryShare: 1, dayType: "trip", includeBuffer: false },
      { date: "2026-07-13", primaryCity: "Paris, France", secondaryCity: null, primaryShare: 1, dayType: "trip", includeBuffer: false },
      { date: "2026-07-14", primaryCity: "Paris, France", secondaryCity: null, primaryShare: 1, dayType: "trip", includeBuffer: false },
      { date: "2026-07-15", primaryCity: "Paris, France", secondaryCity: null, primaryShare: 1, dayType: "trip", includeBuffer: false },
      { date: "2026-07-16", primaryCity: "Paris, France", secondaryCity: null, primaryShare: 0.5, dayType: "trip", includeBuffer: false },
      { date: "2026-07-17", primaryCity: "Paris, France", secondaryCity: null, primaryShare: 1, dayType: "trip", includeBuffer: false },
    ];

    const next = clearCalendarContentInRange(
      state,
      {
        rangeStart: "2026-07-10",
        rangeEnd: "2026-07-16",
        startHalf: "right",
        endHalf: "full",
      },
      state.mainGroupId,
    );

    const days = next.dayPlacesByGroupId.main ?? [];
    assert.equal(days.find((d) => d.date === "2026-07-13"), undefined);
    assert.equal(days.find((d) => d.date === "2026-07-14"), undefined);
    assert.equal(days.find((d) => d.date === "2026-07-16"), undefined);
    assert.equal(days.find((d) => d.date === "2026-07-17"), undefined);
    assert.equal(days.find((d) => d.date === "2026-07-10")?.primaryCity, "Bangkok");
    assert.equal(days.find((d) => d.date === "2026-07-10")?.secondaryCity, null);
  });

  it("clearing a distant half-day does not re-derive stay paint on earlier manual splits", () => {
    const state: TripSetupState = {
      ...baseState(),
      basics: {
        ...baseState().basics,
        startDate: "2026-12-05",
        endDate: "2026-12-22",
        departureCity: "Christchurch",
        returnCity: "Christchurch",
      },
      dayPlacesByGroupId: {
        main: [
          { date: "2026-12-12", primaryCity: "Kagoshima", secondaryCity: null, primaryShare: 1, dayType: "trip", includeBuffer: false },
          {
            date: "2026-12-13",
            primaryCity: "Kagoshima",
            secondaryCity: "Hiroshima",
            primaryShare: 0.5,
            dayType: "trip",
            includeBuffer: false,
          },
          {
            date: "2026-12-22",
            primaryCity: "Christchurch",
            secondaryCity: null,
            primaryShare: 0.5,
            dayType: "trip",
            includeBuffer: false,
          },
        ],
      },
      accommodationStays: [
        {
          id: "hiroshima",
          cityLabel: "Hiroshima",
          stayType: "hotel",
          name: "The Knot",
          url: null,
          address: null,
          phone: null,
          checkInDate: "2026-12-13",
          checkOutDate: "2026-12-16",
          notes: null,
          isHomestayGroup: false,
          multipleInCity: false,
        },
      ],
      activities: [],
    };

    const next = clearCalendarContentInRange(
      state,
      {
        rangeStart: "2026-12-22",
        rangeEnd: "2026-12-22",
        startHalf: "left",
        endHalf: "left",
      },
      state.mainGroupId,
    );

    const dec13 = next.dayPlacesByGroupId.main?.find((d) => d.date === "2026-12-13");
    assert.equal(dec13?.primaryCity, "Kagoshima");
    assert.equal(dec13?.secondaryCity, "Hiroshima");
    assert.equal(next.dayPlacesByGroupId.main?.find((d) => d.date === "2026-12-22"), undefined);
  });

  it("clearing a personal group range does not remove main-group transport legs", () => {
    const state: TripSetupState = {
      ...baseState(),
      groups: [
        { id: "main", name: "Main", type: "main", description: null, sortOrder: 0, isMain: true },
        {
          id: "g-macy",
          name: "Macy",
          type: "split_travel",
          description: null,
          sortOrder: 1,
          isMain: false,
          inheritMode: "independent",
          personalForParticipantId: "p-macy",
        },
      ],
      dayPlacesByGroupId: {
        main: [],
        "g-macy": [
          {
            date: "2026-08-24",
            primaryCity: "Kyoto",
            secondaryCity: null,
            primaryShare: 1,
            dayType: "trip",
            includeBuffer: false,
          },
        ],
      },
      intercityLegs: [
        {
          id: "leg-main",
          legKind: "city_change",
          transportType: "train",
          bookingStatus: "not_booked",
          travelDate: "2026-08-24",
          arrivalDate: null,
          departureTime: null,
          arrivalTime: null,
          fromCity: "Osaka",
          toCity: "Kyoto",
          fromStation: null,
          toStation: null,
          operator: null,
          referenceNumber: null,
          flightNumber: null,
          notes: null,
          intercityFromCity: "Osaka",
          intercityToCity: "Kyoto",
          originGroupId: "main",
        },
      ],
      activities: [],
    };

    const next = clearCalendarContentInRange(
      state,
      {
        rangeStart: "2026-08-24",
        rangeEnd: "2026-08-24",
        startHalf: "full",
        endHalf: "full",
      },
      "g-macy",
    );

    assert.equal(next.intercityLegs.length, 1);
    assert.equal(next.intercityLegs[0]?.id, "leg-main");
    assert.equal(next.dayPlacesByGroupId["g-macy"]?.length, 0);
  });
});
