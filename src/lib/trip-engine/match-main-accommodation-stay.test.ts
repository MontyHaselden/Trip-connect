import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { setupStateToGraph } from "./adapters";
import { applyCommands } from "./apply-commands";
import {
  borrowedMainStaysForParticipant,
  findMatchingMainStay,
  mergePersonalDayPlacesFromMain,
  participantLocationsAlignWithMainStay,
  stayNamesMatch,
} from "./match-main-accommodation-stay";
import { staysForCalendarView } from "./person-lens";
import { staysForGroup } from "./selectors";
import type { TripSetupState } from "@/lib/host/setup/types";

function macyIndependentFixture(): TripSetupState {
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
    dayPlacesByGroupId: {
      "g-main": [
        { date: "2026-12-13", primaryCity: "Hiroshima", secondaryCity: null, primaryShare: 1, dayType: "trip", includeBuffer: false },
        { date: "2026-12-14", primaryCity: "Hiroshima", secondaryCity: null, primaryShare: 1, dayType: "trip", includeBuffer: false },
      ],
      "g-macy": [
        { date: "2026-12-13", primaryCity: "Hiroshima", secondaryCity: null, primaryShare: 1, dayType: "trip", includeBuffer: false },
        { date: "2026-12-14", primaryCity: "Hiroshima", secondaryCity: null, primaryShare: 1, dayType: "trip", includeBuffer: false },
      ],
    },
    outboundLegs: [],
    returnLegs: [],
    intercityLegs: [],
    accommodationStays: [
      {
        id: "stay-knot-main",
        cityLabel: "Hiroshima",
        stayType: "hotel",
        name: "The Knot",
        url: null,
        address: null,
        phone: null,
        checkInDate: "2026-12-13",
        checkOutDate: "2026-12-15",
        notes: null,
        isHomestayGroup: false,
        multipleInCity: false,
      },
    ],
    activities: [],
    overlayOps: [],
  };
}

describe("match-main-accommodation-stay", () => {
  it("stayNamesMatch ignores trailing city suffix", () => {
    assert.ok(stayNamesMatch("The Knot", "The Knot (Hiroshima)"));
  });

  it("findMatchingMainStay returns exact when name and dates match", () => {
    const graph = setupStateToGraph("trip-1", macyIndependentFixture());
    const match = findMatchingMainStay(graph, {
      name: "The Knot",
      cityLabel: "Hiroshima",
      checkInDate: "2026-12-13",
      checkOutDate: "2026-12-15",
    });
    assert.equal(match?.kind, "exact");
    assert.equal(match?.mainStay.id, "stay-knot-main");
  });

  it("findMatchingMainStay returns name_only when dates differ", () => {
    const graph = setupStateToGraph("trip-1", macyIndependentFixture());
    const match = findMatchingMainStay(graph, {
      name: "the knot",
      cityLabel: "Hiroshima",
      checkInDate: "2026-12-15",
      checkOutDate: "2026-12-17",
    });
    assert.equal(match?.kind, "name_only");
    assert.equal(match?.mainStay.name, "The Knot");
  });

  it("borrowedMainStaysForParticipant surfaces aligned main stay without duplicate row", () => {
    const graph = setupStateToGraph("trip-1", macyIndependentFixture());
    const borrowed = borrowedMainStaysForParticipant(graph, "g-macy");
    assert.equal(borrowed.length, 1);
    assert.equal(borrowed[0]?.id, "stay-knot-main");
    assert.equal(staysForGroup(graph, "g-macy").length, 0);
    assert.equal(staysForCalendarView(graph, "g-macy").length, 1);
  });

  it("borrowedMainStaysForParticipant keeps main stay when personal dates do not overlap", () => {
    const graph = setupStateToGraph("trip-1", macyIndependentFixture());
    const withPersonal = applyCommands(graph, [
      {
        type: "addStay",
        groupId: "g-macy",
        stay: {
          id: "stay-knot-macy",
          name: "The Knot",
          cityLabel: "Hiroshima",
          address: null,
          url: null,
          phone: null,
          checkInDate: "2026-12-15",
          checkOutDate: "2026-12-17",
          notes: "Personal dates for Macy",
          stayType: "hotel",
          isHomestayGroup: false,
          multipleInCity: false,
          googlePlaceId: null,
          latitude: null,
          longitude: null,
        },
      },
    ]).graph;

    assert.equal(borrowedMainStaysForParticipant(withPersonal, "g-macy").length, 1);
    assert.equal(staysForCalendarView(withPersonal, "g-macy").length, 2);
  });

  it("borrowedMainStaysForParticipant hides main stay when same-name personal stay overlaps dates", () => {
    const graph = setupStateToGraph("trip-1", macyIndependentFixture());
    const withDuplicate = applyCommands(graph, [
      {
        type: "addStay",
        groupId: "g-macy",
        stay: {
          id: "stay-knot-macy",
          name: "The Knot",
          cityLabel: "Hiroshima",
          address: null,
          url: null,
          phone: null,
          checkInDate: "2026-12-13",
          checkOutDate: "2026-12-15",
          notes: null,
          stayType: "hotel",
          isHomestayGroup: false,
          multipleInCity: false,
          googlePlaceId: null,
          latitude: null,
          longitude: null,
        },
      },
    ]).graph;

    assert.equal(borrowedMainStaysForParticipant(withDuplicate, "g-macy").length, 0);
    assert.equal(staysForCalendarView(withDuplicate, "g-macy").length, 1);
  });

  it("participantLocationsAlignWithMainStay checks night-by-night cities", () => {
    const graph = setupStateToGraph("trip-1", macyIndependentFixture());
    const mainStay = graph.accommodationStays[0]!;
    assert.ok(participantLocationsAlignWithMainStay(graph, "g-macy", mainStay));

    const misaligned = applyCommands(graph, [
      {
        type: "setDayPlaces",
        groupId: "g-macy",
        days: [
          {
            date: "2026-12-13",
            primaryCity: "Kyoto",
            secondaryCity: null,
            primaryShare: 1,
            dayType: "trip",
            includeBuffer: false,
          },
        ],
      },
    ]).graph;
    assert.equal(
      participantLocationsAlignWithMainStay(misaligned, "g-macy", mainStay),
      false,
    );
  });

  it("mergePersonalDayPlacesFromMain copies main nights into personal overlay", () => {
    const graph = setupStateToGraph("trip-1", macyIndependentFixture());
    const mainStay = graph.accommodationStays[0]!;
    const personalDays = graph.dayPlacesByGroupId["g-macy"] ?? [];
    const mainDays = graph.dayPlacesByGroupId["g-main"] ?? [];
    const merged = mergePersonalDayPlacesFromMain(personalDays, mainDays, mainStay);
    assert.ok(merged.some((d) => d.date === "2026-12-13" && d.primaryCity === "Hiroshima"));
    assert.ok(merged.some((d) => d.date === "2026-12-14" && d.primaryCity === "Hiroshima"));
  });
});
