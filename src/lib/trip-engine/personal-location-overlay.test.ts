import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { setupStateToGraph } from "./adapters";
import { applyCommands } from "./apply-commands";
import {
  extractPersonalLocationOverlayDelta,
  mergeMainWithPersonalOverlay,
} from "./personal-location-overlay";
import { staysForCalendarView } from "./person-lens";
import { projectCalendar } from "./project-calendar";
import { calendarContentScopeForGroup, staysForGroup } from "./selectors";
import { TRANSPORT_CORRIDOR_LEFT_SHARE } from "@/lib/host/setup/transport-corridor";
import type { TripSetupState } from "@/lib/host/setup/types";

function japanAmandaFixture(): TripSetupState {
  const homestayDates = [
    "2026-12-06",
    "2026-12-07",
    "2026-12-08",
    "2026-12-09",
    "2026-12-10",
    "2026-12-11",
    "2026-12-12",
  ];

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
        id: "g-amanda",
        name: "Amanda",
        type: "split_travel",
        description: null,
        sortOrder: 1,
        isMain: false,
        inheritMode: "overlay",
        personalForParticipantId: "p-amanda",
      },
    ],
    dayPlacesByGroupId: {
      "g-main": [
        ...homestayDates.map((date) => ({
          date,
          primaryCity: "Kagoshima",
          secondaryCity: null,
          primaryShare: 1,
          dayType: "trip" as const,
          includeBuffer: false,
        })),
        {
          date: "2026-12-13",
          primaryCity: "Kagoshima",
          secondaryCity: "Hiroshima",
          primaryShare: TRANSPORT_CORRIDOR_LEFT_SHARE,
          dayType: "travel" as const,
          includeBuffer: false,
        },
      ],
      "g-amanda": [],
    },
    outboundLegs: [],
    returnLegs: [],
    intercityLegs: [],
    accommodationStays: [
      {
        id: "stay-homestay",
        cityLabel: "Kagoshima",
        stayType: "homestay",
        name: "Homestays",
        url: null,
        address: null,
        phone: null,
        checkInDate: "2026-12-05",
        checkOutDate: "2026-12-13",
        notes: null,
        isHomestayGroup: true,
        multipleInCity: false,
      },
      {
        id: "stay-hiro",
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

describe("personal location overlay", () => {
  it("independent personal plan stores full location paint for every selected day", () => {
    const graph = setupStateToGraph("trip-1", {
      ...japanAmandaFixture(),
      groups: [
        ...(japanAmandaFixture().groups ?? []).map((g) =>
          g.id === "g-amanda"
            ? { ...g, id: "g-macy", name: "Macy", personalForParticipantId: "p-macy", inheritMode: "independent" as const }
            : g,
        ),
      ],
      dayPlacesByGroupId: {
        "g-main": japanAmandaFixture().dayPlacesByGroupId["g-main"] ?? [],
        "g-macy": [],
      },
    });

    const result = applyCommands(graph, [
      {
        type: "paintDayRange",
        groupId: "g-macy",
        rangeStart: "2026-12-05",
        rangeEnd: "2026-12-07",
        location: "Kagoshima",
      },
    ]);

    const stored = result.graph.dayPlacesByGroupId["g-macy"] ?? [];
    const dec5 = stored.find((d) => d.date === "2026-12-05");
    const dec6 = stored.find((d) => d.date === "2026-12-06");
    const dec7 = stored.find((d) => d.date === "2026-12-07");
    assert.equal(dec5?.secondaryCity, "Kagoshima");
    assert.equal(dec5?.primaryShare, 0.5);
    assert.equal(dec6?.primaryCity, "Kagoshima");
    assert.equal(dec6?.primaryShare, 1);
    assert.equal(dec7?.primaryCity, "Kagoshima");
    assert.equal(dec7?.primaryShare, 0.5);

    const projected = projectCalendar(result.graph, { groupId: "g-macy" });
    assert.equal(projected.days.find((d) => d.date === "2026-12-06")?.primaryCity, "Kagoshima");
    assert.equal(projected.days.find((d) => d.date === "2026-12-05")?.secondaryCity, "Kagoshima");
  });

  it("independent calendar derivation does not borrow main stays for cell bands", () => {
    const graph = setupStateToGraph("trip-1", {
      ...japanAmandaFixture(),
      groups: [
        ...(japanAmandaFixture().groups ?? []).map((g) =>
          g.id === "g-amanda"
            ? { ...g, id: "g-macy", name: "Macy", personalForParticipantId: "p-macy", inheritMode: "independent" as const }
            : g,
        ),
      ],
      dayPlacesByGroupId: {
        "g-main": japanAmandaFixture().dayPlacesByGroupId["g-main"] ?? [],
        "g-macy": [],
      },
    });

    const aligned = applyCommands(graph, [
      {
        type: "paintDayRange",
        groupId: "g-macy",
        rangeStart: "2026-12-06",
        rangeEnd: "2026-12-12",
        location: "Kagoshima",
      },
    ]).graph;

    assert.equal(calendarContentScopeForGroup(aligned, "g-macy").stays.length, 0);
  });

  it("stores only city deltas and preserves main travel split on participant calendar", () => {
    const graph = setupStateToGraph("trip-1", japanAmandaFixture());
    const result = applyCommands(graph, [
      {
        type: "paintDayRange",
        groupId: "g-amanda",
        rangeStart: "2026-12-06",
        rangeEnd: "2026-12-13",
        location: "Tottori",
      },
    ]);

    const overlay = result.graph.dayPlacesByGroupId["g-amanda"] ?? [];
    assert.ok(overlay.every((day) => day.date !== "2026-12-13"));
    assert.ok(overlay.some((day) => day.date === "2026-12-12" && day.primaryCity === "Tottori"));

    const main = projectCalendar(result.graph, { groupId: "g-main" });
    const personal = projectCalendar(result.graph, { groupId: "g-amanda" });

    assert.equal(
      main.days.find((d) => d.date === "2026-12-13")?.primaryCity,
      "Kagoshima",
    );
    assert.equal(
      personal.days.find((d) => d.date === "2026-12-13")?.primaryCity,
      "Tottori",
    );
    assert.equal(
      personal.days.find((d) => d.date === "2026-12-13")?.secondaryCity,
      "Hiroshima",
    );
    assert.equal(
      personal.days.find((d) => d.date === "2026-12-12")?.primaryCity,
      "Tottori",
    );
  });

  it("mergeMainWithPersonalOverlay uses main paint before personal overrides", () => {
    const graph = setupStateToGraph("trip-1", japanAmandaFixture());
    const merged = mergeMainWithPersonalOverlay(graph, "g-amanda");
    assert.equal(merged.find((d) => d.date === "2026-12-12")?.primaryCity, "Kagoshima");
  });

  it("extractPersonalLocationOverlayDelta omits flattened travel split days", () => {
    const mainDays = japanAmandaFixture().dayPlacesByGroupId["g-main"] ?? [];
    const delta = extractPersonalLocationOverlayDelta(
      mainDays,
      [
        {
          date: "2026-12-12",
          primaryCity: "Tottori",
          secondaryCity: null,
          primaryShare: 1,
          dayType: "trip",
          includeBuffer: false,
        },
        {
          date: "2026-12-13",
          primaryCity: "Tottori",
          secondaryCity: null,
          primaryShare: 1,
          dayType: "trip",
          includeBuffer: false,
        },
      ],
      [],
      "2026-12-06",
      "2026-12-13",
    );

    assert.equal(delta.length, 1);
    assert.equal(delta[0]?.date, "2026-12-12");
  });

  it("staysForCalendarView surfaces inherited main homestay for location overlay", () => {
    const graph = setupStateToGraph("trip-1", japanAmandaFixture());
    const result = applyCommands(graph, [
      {
        type: "paintDayRange",
        groupId: "g-amanda",
        rangeStart: "2026-12-06",
        rangeEnd: "2026-12-12",
        location: "Tottori",
      },
    ]);

    assert.equal(staysForGroup(result.graph, "g-amanda").length, 0);
    const viewStays = staysForCalendarView(result.graph, "g-amanda");
    assert.ok(viewStays.some((s) => s.name?.includes("Homestays")));
  });

  it("main group calendar ignores participant personal stays", () => {
    const graph = setupStateToGraph("trip-1", japanAmandaFixture());
    const withPersonalStay = applyCommands(graph, [
      {
        type: "paintDayRange",
        groupId: "g-amanda",
        rangeStart: "2026-12-06",
        rangeEnd: "2026-12-12",
        location: "Tottori",
      },
      {
        type: "addStay",
        groupId: "g-amanda",
        stay: {
          id: "stay-amanda-tottori",
          name: "Homestays · Tottori",
          cityLabel: "Tottori",
          url: null,
          address: null,
          phone: null,
          checkInDate: "2026-12-06",
          checkOutDate: "2026-12-13",
          notes: null,
          stayType: "homestay",
          isHomestayGroup: true,
          multipleInCity: true,
          originGroupId: "g-amanda",
        },
      },
    ]).graph;

    const mainBefore = projectCalendar(graph, { groupId: "g-main" });
    const mainAfter = projectCalendar(withPersonalStay, { groupId: "g-main" });

    assert.deepEqual(
      mainAfter.days.map((d) => ({
        date: d.date,
        primaryCity: d.primaryCity,
        secondaryCity: d.secondaryCity,
        accommodationLabel: d.accommodationLabel,
      })),
      mainBefore.days.map((d) => ({
        date: d.date,
        primaryCity: d.primaryCity,
        secondaryCity: d.secondaryCity,
        accommodationLabel: d.accommodationLabel,
      })),
    );
  });
});
