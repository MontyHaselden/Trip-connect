import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { setupStateToGraph } from "./adapters";
import { applyCommands } from "./apply-commands";
import {
  borrowMainStayOverlayOp,
  buildAdoptMainGroupStayCommands,
  borrowedMainActivitiesForParticipant,
  borrowedMainStaysForParticipant,
  canAdoptMainGroupStayForParticipant,
  findMatchingMainStay,
  isBorrowMainStayOp,
  mainStaysOverlappingRange,
  mergePersonalDayPlacesFromMain,
  participantLocationsAlignWithMainStay,
  stayNamesMatch,
  suggestedMainStaysForParticipantEdit,
} from "./match-main-accommodation-stay";
import { activitiesForCalendarView, staysForCalendarView } from "./person-lens";
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

  it("suggestedMainStaysForParticipantEdit lists overlapping main hotel before typing", () => {
    const graph = setupStateToGraph("trip-1", macyIndependentFixture());
    const suggestions = suggestedMainStaysForParticipantEdit(
      graph,
      "g-macy",
      "2026-12-13",
      "2026-12-15",
    );
    assert.equal(suggestions.length, 1);
    assert.equal(suggestions[0]?.name, "The Knot");
  });

  it("mainStaysOverlappingRange returns stays that share any night", () => {
    const graph = setupStateToGraph("trip-1", macyIndependentFixture());
    const overlapping = mainStaysOverlappingRange(graph, "2026-12-14", "2026-12-16");
    assert.equal(overlapping.length, 1);
    assert.equal(overlapping[0]?.name, "The Knot");
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

  it("canAdoptMainGroupStayForParticipant requires matching dates and no same-name personal row", () => {
    const graph = setupStateToGraph("trip-1", macyIndependentFixture());
    const mainStay = graph.accommodationStays[0]!;
    assert.ok(
      canAdoptMainGroupStayForParticipant(graph, "g-macy", mainStay, {
        checkInDate: "2026-12-13",
        checkOutDate: "2026-12-15",
      }),
    );
    assert.equal(
      canAdoptMainGroupStayForParticipant(graph, "g-macy", mainStay, {
        checkInDate: "2026-12-15",
        checkOutDate: "2026-12-17",
      }),
      false,
    );
  });

  it("isBorrowMainStayOp detects self-replace borrow markers", () => {
    const op = borrowMainStayOverlayOp("g-macy", "stay-yaeno");
    assert.ok(isBorrowMainStayOp(op));
  });

  it("buildAdoptMainGroupStayCommands borrows hotel and paints main locations on its nights", () => {
    const base = macyIndependentFixture();
    base.dayPlacesByGroupId["g-main"] = [
      ...(base.dayPlacesByGroupId["g-main"] ?? []),
      {
        date: "2026-12-18",
        primaryCity: "Kyoto",
        secondaryCity: "Tokyo, Japan",
        primaryShare: 0.5,
        dayType: "trip" as const,
        includeBuffer: false,
      },
      ...["2026-12-19", "2026-12-20"].map((date) => ({
        date,
        primaryCity: "Tokyo, Japan",
        secondaryCity: null,
        primaryShare: 1,
        dayType: "trip" as const,
        includeBuffer: false,
      })),
    ];
    base.dayPlacesByGroupId["g-macy"] = [
      ...(base.dayPlacesByGroupId["g-macy"] ?? []),
      {
        date: "2026-12-18",
        primaryCity: "Kyoto",
        secondaryCity: "Tokyo",
        primaryShare: 0.5,
        dayType: "trip" as const,
        includeBuffer: false,
      },
      { date: "2026-12-19", primaryCity: "Osaka", secondaryCity: null, primaryShare: 1, dayType: "trip", includeBuffer: false },
      { date: "2026-12-20", primaryCity: "Osaka", secondaryCity: null, primaryShare: 1, dayType: "trip", includeBuffer: false },
    ];
    base.accommodationStays.push({
      id: "stay-yaeno",
      cityLabel: "Tokyo, Japan",
      stayType: "hotel",
      name: "Hotel Yaenomidori Tokyo",
      url: null,
      address: null,
      phone: null,
      checkInDate: "2026-12-18",
      checkOutDate: "2026-12-21",
      notes: null,
      isHomestayGroup: false,
      multipleInCity: false,
    });
    base.activities = [
      {
        id: "act-tower",
        title: "Tokyo tower",
        date: "2026-12-19",
        endDate: null,
        startTime: "10:00",
        endTime: null,
        isTimeTbc: false,
        category: "activity",
        locationName: null,
        address: null,
        isLocationTbc: true,
        transportNote: null,
        leaveByTime: null,
        bringNote: null,
        description: null,
        audienceType: "everyone",
        audienceId: null,
        bookingStatus: "not_booked",
      },
    ];

    const graph = setupStateToGraph("trip-1", base);
    const mainStay = graph.accommodationStays.find((stay) => stay.id === "stay-yaeno")!;
    const adopted = applyCommands(
      graph,
      buildAdoptMainGroupStayCommands(graph, "g-macy", mainStay),
    ).graph;

    assert.equal(
      adopted.dayPlacesByGroupId["g-macy"]?.find((d) => d.date === "2026-12-18")?.primaryCity,
      "Tokyo, Japan",
    );
    assert.equal(
      adopted.dayPlacesByGroupId["g-macy"]?.find((d) => d.date === "2026-12-18")?.secondaryCity,
      null,
    );
    assert.equal(
      adopted.dayPlacesByGroupId["g-macy"]?.find((d) => d.date === "2026-12-19")?.primaryCity,
      "Tokyo, Japan",
    );
    assert.ok(
      borrowedMainStaysForParticipant(adopted, "g-macy").some((stay) => stay.id === mainStay.id),
    );
    assert.equal(borrowedMainActivitiesForParticipant(adopted, "g-macy").length, 1);
    assert.ok(
      staysForCalendarView(adopted, "g-macy").some((stay) => stay.id === mainStay.id),
    );
  });

  it("mergePersonalDayPlacesFromMain drops main transfer corridor on check-in night", () => {
    const graph = setupStateToGraph("trip-1", macyIndependentFixture());
    const mainStay = graph.accommodationStays[0]!;
    const personalDays = graph.dayPlacesByGroupId["g-macy"] ?? [];
    const mainDays = [
      ...(graph.dayPlacesByGroupId["g-main"] ?? []),
      {
        date: "2026-12-13",
        primaryCity: "Hiroshima",
        secondaryCity: "Kyoto",
        primaryShare: 0.5,
        dayType: "trip" as const,
        includeBuffer: false,
      },
      {
        date: "2026-12-14",
        primaryCity: "Hiroshima",
        secondaryCity: null,
        primaryShare: 1,
        dayType: "trip" as const,
        includeBuffer: false,
      },
    ];
    const merged = mergePersonalDayPlacesFromMain(personalDays, mainDays, mainStay);
    const checkInDay = merged.find((d) => d.date === "2026-12-13");
    assert.equal(checkInDay?.primaryCity, "Hiroshima");
    assert.equal(checkInDay?.secondaryCity, null);
    assert.equal(checkInDay?.primaryShare, 1);
    assert.ok(merged.some((d) => d.date === "2026-12-14" && d.primaryCity === "Hiroshima"));
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

  it("setDayPlaces on independent participant adopts main stay for calendar borrowing", () => {
    const base = macyIndependentFixture();
    const tokyoNights = ["2026-12-18", "2026-12-19", "2026-12-20"] as const;
    base.dayPlacesByGroupId["g-main"] = [
      ...(base.dayPlacesByGroupId["g-main"] ?? []),
      ...tokyoNights.map((date) => ({
        date,
        primaryCity: "Tokyo, Japan",
        secondaryCity: null,
        primaryShare: 1,
        dayType: "trip" as const,
        includeBuffer: false,
      })),
    ];
    base.accommodationStays.push({
      id: "stay-yaeno",
      cityLabel: "Tokyo, Japan",
      stayType: "hotel",
      name: "Hotel Yaenomidori Tokyo",
      url: null,
      address: null,
      phone: null,
      checkInDate: "2026-12-18",
      checkOutDate: "2026-12-21",
      notes: null,
      isHomestayGroup: false,
      multipleInCity: false,
    });

    const graph = setupStateToGraph("trip-1", base);
    const mainStay = graph.accommodationStays.find((stay) => stay.id === "stay-yaeno")!;
    const merged = mergePersonalDayPlacesFromMain(
      graph.dayPlacesByGroupId["g-macy"] ?? [],
      graph.dayPlacesByGroupId["g-main"] ?? [],
      mainStay,
    );

    const adopted = applyCommands(graph, [
      { type: "setDayPlaces", groupId: "g-macy", days: merged },
    ]).graph;

    assert.ok(participantLocationsAlignWithMainStay(adopted, "g-macy", mainStay));
    assert.ok(
      borrowedMainStaysForParticipant(adopted, "g-macy").some((stay) => stay.id === mainStay.id),
    );
    assert.ok(
      staysForCalendarView(adopted, "g-macy").some((stay) => stay.id === mainStay.id),
    );
  });

  it("borrowedMainActivitiesForParticipant includes main activities on aligned dates", () => {
    const base = macyIndependentFixture();
    base.dayPlacesByGroupId["g-main"] = [
      ...(base.dayPlacesByGroupId["g-main"] ?? []),
      { date: "2026-12-18", primaryCity: "Tokyo", secondaryCity: null, primaryShare: 1, dayType: "trip", includeBuffer: false },
      { date: "2026-12-19", primaryCity: "Tokyo", secondaryCity: null, primaryShare: 1, dayType: "trip", includeBuffer: false },
    ];
    base.dayPlacesByGroupId["g-macy"] = [
      ...(base.dayPlacesByGroupId["g-macy"] ?? []),
      { date: "2026-12-18", primaryCity: "Tokyo", secondaryCity: null, primaryShare: 1, dayType: "trip", includeBuffer: false },
      { date: "2026-12-19", primaryCity: "Tokyo", secondaryCity: null, primaryShare: 1, dayType: "trip", includeBuffer: false },
    ];
    base.activities = [
      {
        id: "act-tower",
        title: "Tokyo tower",
        date: "2026-12-18",
        endDate: null,
        startTime: "10:00",
        endTime: null,
        isTimeTbc: false,
        category: "activity",
        locationName: null,
        address: null,
        isLocationTbc: true,
        transportNote: null,
        leaveByTime: null,
        bringNote: null,
        description: null,
        audienceType: "everyone",
        audienceId: null,
        bookingStatus: "not_booked",
      },
      {
        id: "act-shibuya",
        title: "Shibuya day",
        date: "2026-12-19",
        endDate: null,
        startTime: "10:00",
        endTime: null,
        isTimeTbc: false,
        category: "activity",
        locationName: null,
        address: null,
        isLocationTbc: true,
        transportNote: null,
        leaveByTime: null,
        bringNote: null,
        description: null,
        audienceType: "everyone",
        audienceId: null,
        bookingStatus: "not_booked",
      },
      {
        id: "act-usj",
        title: "Visit USJ",
        date: "2026-12-16",
        endDate: null,
        startTime: "10:00",
        endTime: null,
        isTimeTbc: false,
        category: "activity",
        locationName: null,
        address: null,
        isLocationTbc: true,
        transportNote: null,
        leaveByTime: null,
        bringNote: null,
        description: null,
        audienceType: "everyone",
        audienceId: null,
        bookingStatus: "not_booked",
      },
    ];
    const graph = setupStateToGraph("trip-1", base);
    const borrowed = borrowedMainActivitiesForParticipant(graph, "g-macy");
    assert.deepEqual(
      borrowed.map((a) => a.id).sort(),
      ["act-shibuya", "act-tower"],
    );
    const calendarActivities = activitiesForCalendarView(graph, "g-macy");
    assert.equal(calendarActivities.length, 2);
    assert.equal(activitiesForCalendarView(graph, "g-macy").some((a) => a.id === "act-usj"), false);
  });
});
