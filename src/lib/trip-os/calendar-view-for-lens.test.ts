import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { buildCalendarRenderModel } from "@/lib/trip-engine/calendar-render-model";
import { fastStubEngineCalendarView } from "@/lib/trip-engine/stub-engine-view";
import type { TripEntityGraph } from "@/lib/trip-engine/types";

import { calendarViewForLens } from "./calendar-view-for-lens";

function minimalGraph(): TripEntityGraph {
  return {
    tripId: "trip-1",
    mainGroupId: "group-main",
    basics: {
      name: "Japan 2026",
      schoolName: "School",
      startDate: "2026-12-05",
      endDate: "2026-12-21",
      timezone: "Pacific/Auckland",
      departureCity: "Christchurch",
      returnCity: "Christchurch",
      defaultDepartureAirport: null,
      destinationCountries: ["Japan"],
    },
    groups: [
      {
        id: "group-main",
        name: "Main",
        type: "whole_group",
        description: null,
        sortOrder: 0,
        isMain: true,
        inheritMode: null,
        personalForParticipantId: null,
      },
    ],
    dayPlacesByGroupId: {
      "group-main": [
        {
          date: "2026-12-05",
          primaryCity: "Tokyo",
          secondaryCity: null,
          primaryShare: 1,
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
    bookingsSummary: [],
    emergencySummary: { localEmergencyNumber: null, schoolEmergencyPhone: null },
    publishSummary: { viewerGalleryEnabled: true, viewerRoomDetailsEnabled: true },
  };
}

describe("calendarViewForLens", () => {
  it("derives a painted calendar when the cached shell is empty for another group", () => {
    const graph = minimalGraph();
    const stub = fastStubEngineCalendarView(graph, "group-main");
    const view = calendarViewForLens(graph, "group-main", {
      calendarRenderModel: stub.calendarRenderModel,
      calendarProjection: stub.calendarProjection,
      costLedger: null,
    });

    assert.ok(view.calendarRenderModel.days.length > 0);
    assert.ok(
      view.calendarRenderModel.days.some((day) => day.primaryCity.trim() === "Tokyo"),
    );
  });

  it("rebuilds when the lens group differs from the cached model group", () => {
    const graph = minimalGraph();
    const main = buildCalendarRenderModel(graph, { groupId: "group-main" });
    const view = calendarViewForLens(graph, "group-main", {
      calendarRenderModel: { ...main, groupId: "other" },
      calendarProjection: {
        groupId: "other",
        gridStart: main.gridStart,
        gridEnd: main.gridEnd,
        days: [],
        accommodationByDate: new Map(),
        boundaries: [],
      },
      costLedger: null,
    });

    assert.equal(view.calendarRenderModel.groupId, "group-main");
    assert.ok(view.calendarRenderModel.days.length > 0);
  });

  it("rebuilds when the graph changes but the cached model group still matches", () => {
    const graph = minimalGraph();
    const cached = buildCalendarRenderModel(graph, { groupId: "group-main" });
    const updated = {
      ...graph,
      dayPlacesByGroupId: {
        "group-main": [
          ...(graph.dayPlacesByGroupId["group-main"] ?? []),
          {
            date: "2026-12-13",
            primaryCity: "Kagoshima",
            secondaryCity: "Hiroshima",
            primaryShare: 0.5,
            dayType: "trip" as const,
            includeBuffer: false,
          },
        ],
      },
    };
    const view = calendarViewForLens(updated, "group-main", {
      calendarRenderModel: cached,
      calendarProjection: {
        groupId: "group-main",
        gridStart: cached.gridStart,
        gridEnd: cached.gridEnd,
        days: cached.projectedDays,
        accommodationByDate: cached.accommodationByDate,
        boundaries: cached.boundaries,
      },
      costLedger: null,
    });

    const dec13 = view.calendarRenderModel.days.find((day) => day.date === "2026-12-13");
    assert.equal(dec13?.primaryCity, "Kagoshima");
    assert.equal(dec13?.secondaryCity, "Hiroshima");
  });
});
