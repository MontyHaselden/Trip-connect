import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { setupStateToGraph } from "./adapters";
import { applyCommands } from "./apply-commands";
import { pendingTransportNeedKey } from "./hidden-pending-transport";
import { pendingTransportNeedsFromCalendar, hiddenPendingTransportNeedsFromCalendar } from "./pending-city-moves";
import type { TripSetupState } from "@/lib/host/setup/types";

function baseState(): TripSetupState {
  return {
    basics: {
      name: "Japan",
      schoolName: "",
      startDate: "2026-12-20",
      endDate: "2026-12-25",
      timezone: "Asia/Tokyo",
      departureCity: "Christchurch",
      returnCity: "Christchurch",
      defaultDepartureAirport: "",
      destinationCountries: ["Japan"],
    },
    mainGroupId: "main",
    groups: [
      {
        id: "main",
        name: "Main",
        type: "main",
        description: null,
        sortOrder: 0,
        isMain: true,
      },
    ],
    dayPlacesByGroupId: {
      main: [
        {
          date: "2026-12-22",
          primaryCity: "Kyoto",
          secondaryCity: null,
          primaryShare: 1,
          dayType: "trip",
          includeBuffer: false,
        },
        {
          date: "2026-12-23",
          primaryCity: "Kyoto",
          secondaryCity: "Tokyo",
          primaryShare: 0.5,
          dayType: "travel",
          includeBuffer: false,
        },
        {
          date: "2026-12-24",
          primaryCity: "Tokyo",
          secondaryCity: null,
          primaryShare: 1,
          dayType: "trip",
          includeBuffer: false,
        },
      ],
    },
    outboundLegs: [],
    returnLegs: [],
    intercityLegs: [],
    accommodationStays: [],
    activities: [],
    overlayOps: [],
  };
}

describe("hidden pending transport needs", () => {
  it("builds a stable key per group and route", () => {
    const key = pendingTransportNeedKey("group-1", {
      kind: "intercity",
      date: "2026-12-11",
      fromCity: "Macys Home",
      toCity: "Kagoshima",
    });
    assert.equal(key, "group-1|intercity|2026-12-11|macys home|kagoshima");
  });

  it("filters hidden needs from the visible transport list", () => {
    const graph = setupStateToGraph("trip-1", baseState());
    const pending = pendingTransportNeedsFromCalendar(graph, graph.mainGroupId);
    assert.ok(pending.length > 0);

    const need = pending[0]!;
    const key = pendingTransportNeedKey(graph.mainGroupId, need);
    const hiddenGraph = {
      ...graph,
      hiddenPendingTransportNeedKeys: [key],
    };

    assert.equal(
      pendingTransportNeedsFromCalendar(hiddenGraph, graph.mainGroupId).length,
      pending.length - 1,
    );
    assert.equal(hiddenPendingTransportNeedsFromCalendar(hiddenGraph, graph.mainGroupId).length, 1);
  });

  it("applies hide and unhide commands in memory", () => {
    const graph = setupStateToGraph("trip-1", baseState());
    const need = pendingTransportNeedsFromCalendar(graph, graph.mainGroupId)[0]!;
    const hidden = applyCommands(graph, [
      {
        type: "hidePendingTransportNeed",
        groupId: graph.mainGroupId,
        need,
      },
    ]).graph;
    assert.equal(hidden.hiddenPendingTransportNeedKeys?.length, 1);

    const restored = applyCommands(hidden, [
      {
        type: "unhidePendingTransportNeed",
        groupId: graph.mainGroupId,
        need,
      },
    ]).graph;
    assert.equal(restored.hiddenPendingTransportNeedKeys?.length, 0);
  });
});
