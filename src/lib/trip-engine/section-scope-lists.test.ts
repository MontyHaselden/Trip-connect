import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { TripSetupState } from "@/lib/host/setup/types";

import { setupStateToGraph } from "./adapters";
import { applyCommands } from "./apply-commands";
import {
  activitiesListedByScope,
  pendingTransportNeedsListedByScope,
  staysForAccommodationScopeListing,
  staysListedByScope,
} from "./section-scope-lists";
import type { RosterSummary } from "./types";

function baseFixture(): TripSetupState {
  return {
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
    dayPlacesByGroupId: { "g-main": [], "g-macy": [] },
    outboundLegs: [],
    returnLegs: [],
    intercityLegs: [],
    accommodationStays: [
      {
        id: "stay-tokyo",
        cityLabel: "Tokyo",
        stayType: "hotel",
        name: "Hotel Villa Fontaine",
        url: null,
        address: null,
        phone: null,
        checkInDate: "2026-12-05",
        checkOutDate: "2026-12-06",
        notes: null,
        isHomestayGroup: false,
        multipleInCity: false,
      },
    ],
    activities: [
      {
        id: "act-main",
        title: "Team dinner",
        date: "2026-12-10",
        endDate: null,
        startTime: "18:00",
        endTime: "20:00",
        isTimeTbc: false,
        locationName: "Tokyo",
        notes: null,
      },
    ],
    overlayOps: [],
  };
}

function roster(): RosterSummary {
  return {
    participants: [
      {
        id: "p-macy",
        fullName: "Macy Spragg",
        role: "student",
        groupIds: ["g-main", "g-macy"],
        inCostSplit: true,
      },
    ],
    groups: [],
    rooms: [],
  };
}

describe("section scope lists", () => {
  it("surfaces personal stays on whole group accommodation view", () => {
    const graph = applyCommands(setupStateToGraph("trip-1", baseFixture()), [
      {
        type: "addStay",
        groupId: "g-macy",
        stay: {
          id: "stay-macy-home",
          name: "Macy's home",
          cityLabel: "Kagoshima",
          address: null,
          url: null,
          phone: null,
          checkInDate: "2026-12-06",
          checkOutDate: "2026-12-13",
          notes: null,
          stayType: "homestay",
          isHomestayGroup: true,
          multipleInCity: false,
          googlePlaceId: null,
          latitude: null,
          longitude: null,
        },
      },
    ]).graph;

    const lists = staysListedByScope(graph, roster(), graph.mainGroupId);

    assert.equal(lists.wholeGroup.items.length, 1);
    assert.equal(lists.wholeGroup.items[0]?.name, "Hotel Villa Fontaine");
    assert.equal(lists.otherScopes.length, 1);
    assert.equal(lists.otherScopes[0]?.title, "Macy Spragg");
    assert.equal(lists.otherScopes[0]?.items[0]?.name, "Macy's home");
  });

  it("still lists all personal scopes when viewing a participant calendar", () => {
    const graph = applyCommands(setupStateToGraph("trip-1", baseFixture()), [
      {
        type: "addStay",
        groupId: "g-macy",
        stay: {
          id: "stay-macy-home",
          name: "Macy's home",
          cityLabel: "Kagoshima",
          address: null,
          url: null,
          phone: null,
          checkInDate: "2026-12-06",
          checkOutDate: "2026-12-13",
          notes: null,
          stayType: "homestay",
          isHomestayGroup: true,
          multipleInCity: false,
          googlePlaceId: null,
          latitude: null,
          longitude: null,
        },
      },
    ]).graph;

    const lists = staysListedByScope(graph, roster(), "g-macy");

    assert.equal(lists.wholeGroup.items.length, 1);
    assert.equal(lists.otherScopes.length, 1);
    assert.equal(lists.otherScopes[0]?.groupId, "g-macy");
  });

  it("lists personal activities under participant scope on whole group view", () => {
    const graph = applyCommands(setupStateToGraph("trip-1", baseFixture()), [
      {
        type: "addActivity",
        groupId: "g-macy",
        activity: {
          id: "act-macy",
          title: "Family visit",
          date: "2026-12-08",
          endDate: null,
          startTime: null,
          endTime: null,
          isTimeTbc: true,
          locationName: "Kagoshima",
          notes: null,
        },
      },
    ]).graph;

    const lists = activitiesListedByScope(graph, roster(), graph.mainGroupId);

    assert.equal(lists.wholeGroup.items.length, 1);
    assert.equal(lists.otherScopes.length, 1);
    assert.equal(lists.otherScopes[0]?.items[0]?.title, "Family visit");
  });

  it("hides personal stay rows that duplicate a main-group hotel leg", () => {
    const graph = applyCommands(setupStateToGraph("trip-1", baseFixture()), [
      {
        type: "addStay",
        groupId: "g-main",
        stay: {
          id: "stay-grand-prince",
          name: "Grand Prince Hotel Shin Takanawa",
          cityLabel: "Tokyo",
          address: null,
          url: null,
          phone: null,
          checkInDate: "2026-12-17",
          checkOutDate: "2026-12-21",
          notes: null,
          stayType: "hotel",
          isHomestayGroup: false,
          multipleInCity: false,
          googlePlaceId: null,
          latitude: null,
          longitude: null,
        },
      },
      {
        type: "addStay",
        groupId: "g-macy",
        stay: {
          id: "stay-grand-prince-macy",
          name: "Grand Prince Hotel Shin Takanawa",
          cityLabel: "Tokyo",
          address: null,
          url: null,
          phone: null,
          checkInDate: "2026-12-17",
          checkOutDate: "2026-12-21",
          notes: null,
          stayType: "hotel",
          isHomestayGroup: false,
          multipleInCity: false,
          googlePlaceId: null,
          latitude: null,
          longitude: null,
        },
      },
      {
        type: "addStay",
        groupId: "g-macy",
        stay: {
          id: "stay-macy-home",
          name: "Macys home",
          cityLabel: "Kagoshima",
          address: null,
          url: null,
          phone: null,
          checkInDate: "2026-12-08",
          checkOutDate: "2026-12-10",
          notes: null,
          stayType: "homestay",
          isHomestayGroup: true,
          multipleInCity: false,
          googlePlaceId: null,
          latitude: null,
          longitude: null,
        },
      },
    ]).graph;

    const macyStays = staysForAccommodationScopeListing(graph, "g-macy");
    assert.equal(macyStays.length, 1);
    assert.equal(macyStays[0]?.name, "Macys home");

    const lists = staysListedByScope(graph, roster(), graph.mainGroupId);
    assert.equal(lists.otherScopes[0]?.items.length, 1);
    assert.equal(lists.otherScopes[0]?.items[0]?.name, "Macys home");
  });

  it("lists personal pending transport under participant scope on whole group view", () => {
    const graph = applyCommands(setupStateToGraph("trip-1", baseFixture()), [
      {
        type: "paintDayRange",
        groupId: "g-main",
        rangeStart: "2026-12-05",
        rangeEnd: "2026-12-21",
        location: "Tokyo",
      },
      {
        type: "setDayPlaces",
        groupId: "g-macy",
        days: [
          {
            date: "2026-12-10",
            primaryCity: "Macys home",
            secondaryCity: null,
            primaryShare: 1,
            dayType: "trip",
            includeBuffer: false,
          },
          {
            date: "2026-12-11",
            primaryCity: "Macys home",
            secondaryCity: "Kagoshima",
            primaryShare: 0.5,
            dayType: "travel",
            includeBuffer: false,
          },
          {
            date: "2026-12-12",
            primaryCity: "Kagoshima",
            secondaryCity: null,
            primaryShare: 1,
            dayType: "trip",
            includeBuffer: false,
          },
        ],
      },
    ]).graph;

    const lists = pendingTransportNeedsListedByScope(graph, roster(), graph.mainGroupId);

    assert.equal(lists.otherScopes.length, 1);
    assert.match(lists.otherScopes[0]?.title ?? "", /Macy/i);
    const intercityNeed = lists.otherScopes[0]?.items.find((item) => item.kind === "intercity");
    assert.ok(intercityNeed);
    assert.match(intercityNeed.fromCity ?? "", /Macys home/i);
    assert.match(intercityNeed.toCity ?? "", /Kagoshima/i);
  });
});
