import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { setupStateToGraph } from "@/lib/trip-engine/adapters";
import { applyCommands } from "@/lib/trip-engine/apply-commands";
import { projectCalendar } from "@/lib/trip-engine/project-calendar";
import type { TripEntityGraph } from "@/lib/trip-engine/types";

import { setDayPlacesForGroup } from "./graph-bridge";

function baseGraph(): TripEntityGraph {
  return setupStateToGraph("trip-1", {
    basics: {
      name: "Japan",
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
      {
        id: "g-kaleb",
        name: "Kaleb",
        type: "split_travel",
        description: null,
        sortOrder: 2,
        isMain: false,
        inheritMode: "overlay",
        personalForParticipantId: "p-kaleb",
      },
    ],
    dayPlacesByGroupId: {
      "g-main": [
        {
          date: "2026-12-13",
          primaryCity: "Kagoshima",
          secondaryCity: "Hiroshima",
          primaryShare: 0.5,
          dayType: "trip",
          includeBuffer: false,
        },
        {
          date: "2026-12-14",
          primaryCity: "Hiroshima",
          secondaryCity: "Kyoto",
          primaryShare: 0.5,
          dayType: "trip",
          includeBuffer: false,
        },
      ],
      "g-amanda": [
        {
          date: "2026-12-06",
          primaryCity: "Tokyo",
          secondaryCity: "Tottori",
          primaryShare: 0.5,
          dayType: "trip",
          includeBuffer: false,
        },
      ],
      "g-kaleb": [
        {
          date: "2026-12-07",
          primaryCity: "Tokyo",
          secondaryCity: "Tottori",
          primaryShare: 0.5,
          dayType: "trip",
          includeBuffer: false,
        },
      ],
    },
    accommodationStays: [],
    outboundLegs: [],
    returnLegs: [],
    intercityLegs: [],
    activities: [],
    overlayOps: [],
    transportProducts: [],
  });
}

describe("setDayPlacesForGroup overlay merge", () => {
  it("patches one split day without wiping other personal override dates", () => {
    const graph = baseGraph();
    const patch = [
      {
        date: "2026-12-13",
        primaryCity: "Tottori",
        secondaryCity: "Hiroshima",
        primaryShare: 0.5,
        dayType: "trip" as const,
        includeBuffer: false,
      },
    ];

    const amanda = setDayPlacesForGroup(graph, "g-amanda", patch);
    assert.ok(amanda.some((day) => day.date === "2026-12-06"));
    assert.ok(
      amanda.some(
        (day) => day.date === "2026-12-13" && day.primaryCity === "Tottori",
      ),
    );

    const kaleb = setDayPlacesForGroup(graph, "g-kaleb", patch);
    assert.ok(kaleb.some((day) => day.date === "2026-12-07"));
    assert.ok(
      kaleb.some(
        (day) => day.date === "2026-12-13" && day.primaryCity === "Tottori",
      ),
    );
  });
});

describe("party setDayPlaces fan-out", () => {
  it("keeps per-traveller override dates when the same split patch fans out", () => {
    const graph = baseGraph();
    const patch = [
      {
        date: "2026-12-13",
        primaryCity: "Tottori",
        secondaryCity: "Hiroshima",
        primaryShare: 0.5,
        dayType: "trip" as const,
        includeBuffer: false,
      },
    ];

    const commands = [
      { type: "setDayPlaces" as const, groupId: "g-amanda", days: patch },
      { type: "setDayPlaces" as const, groupId: "g-kaleb", days: patch },
    ];

    const result = applyCommands(graph, commands).graph;
    const amanda = result.dayPlacesByGroupId["g-amanda"] ?? [];
    const kaleb = result.dayPlacesByGroupId["g-kaleb"] ?? [];

    assert.ok(amanda.some((day) => day.date === "2026-12-06"));
    assert.ok(kaleb.some((day) => day.date === "2026-12-07"));
    assert.ok(
      amanda.some((day) => day.date === "2026-12-13" && day.primaryCity === "Tottori"),
    );
    assert.ok(
      kaleb.some((day) => day.date === "2026-12-13" && day.primaryCity === "Tottori"),
    );
  });

  it("projects the same Tottori → Hiroshima split for every party traveller", () => {
    const graph = baseGraph();
    const patch = [
      {
        date: "2026-12-13",
        primaryCity: "Tottori",
        secondaryCity: "Hiroshima",
        primaryShare: 0.5,
        dayType: "trip" as const,
        includeBuffer: false,
      },
    ];

    const result = applyCommands(graph, [
      { type: "setDayPlaces" as const, groupId: "g-amanda", days: patch },
      { type: "setDayPlaces" as const, groupId: "g-kaleb", days: patch },
    ]).graph;

    for (const groupId of ["g-amanda", "g-kaleb"] as const) {
      const day = projectCalendar(result, { groupId }).days.find(
        (d) => d.date === "2026-12-13",
      );
      assert.equal(day?.primaryCity, "Tottori");
      assert.equal(day?.secondaryCity, "Hiroshima");
      assert.equal(day?.primaryShare, 0.5);
    }

    const amandaStored = result.dayPlacesByGroupId["g-amanda"]?.find(
      (d) => d.date === "2026-12-13",
    );
    assert.equal(amandaStored?.secondaryCity, "Hiroshima");
  });
});
