import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DateTime } from "luxon";

import { weekStartMonday } from "@/lib/host/setup/calendar-bounds";
import { setupStateToGraph } from "./adapters";
import { buildCalendarRenderModel } from "./calendar-render-model";
import { applyCommands } from "./apply-commands";
import type { TripSetupState } from "@/lib/host/setup/types";
import { newId } from "@/lib/host/wizard/types";

function baseState(): TripSetupState {
  return {
    basics: {
      name: "Trip",
      schoolName: "",
      startDate: "2026-08-23",
      endDate: "2026-09-05",
      timezone: "UTC",
      departureCity: "CHC",
      returnCity: "CHC",
      defaultDepartureAirport: "",
      destinationCountries: ["Thailand"],
    },
    mainGroupId: "g1",
    groups: [{ id: "g1", name: "Main", type: "main", description: null, sortOrder: 0, isMain: true }],
    dayPlacesByGroupId: { g1: [] },
    outboundLegs: [],
    returnLegs: [],
    intercityLegs: [],
    accommodationStays: [],
    activities: [],
    overlayOps: [],
  };
}

describe("buildCalendarRenderModel", () => {
  it("includes travel layouts and activity markers", () => {
    let graph = setupStateToGraph("t1", baseState());
    graph = applyCommands(graph, [
      {
        type: "addActivity",
        groupId: "g1",
        activity: {
          id: newId(),
          title: "Temple",
          date: "2026-08-26",
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
      },
      {
        type: "addTransportLeg",
        groupId: "g1",
        bucket: "intercity",
        leg: {
          id: newId(),
          transportType: "plane",
          bookingStatus: "not_booked",
          travelDate: "2026-09-04",
          arrivalDate: "2026-09-04",
          departureTime: "21:00",
          arrivalTime: "23:00",
          fromCity: "BKK",
          toCity: "MEL",
          fromStation: "BKK",
          toStation: "MEL",
          operator: null,
          referenceNumber: null,
          flightNumber: "QF1",
          notes: null,
          intercityFromCity: "BKK",
          intercityToCity: "MEL",
        },
      },
    ]).graph;

    const model = buildCalendarRenderModel(graph);
    assert.equal(model.scrollAnchorDate, "2026-08-26");
    assert.ok(model.activitiesByDate.has("2026-08-26"));
    assert.equal(model.activitiesByDate.get("2026-08-26")?.[0]?.title, "Temple");
    assert.ok(model.travelLayoutsByDate.size > 0 || model.transitByDate.size > 0);
    assert.ok(model.days.length > 0);
    assert.ok(model.boundaries.length >= 0);
    assert.ok(model.todayIso);
    assert.ok(model.interactionStart);
  });

  it("unset trip dates use today floor — grid never before todayIso", () => {
    const state = baseState();
    state.basics.startDate = "2000-01-01";
    state.basics.endDate = "2000-01-01";
    const graph = setupStateToGraph("t1", state);
    const model = buildCalendarRenderModel(graph);
    const todayMonday = weekStartMonday(DateTime.fromISO(model.todayIso)).toISODate()!;
    assert.equal(model.datesUnset, true);
    assert.ok(model.gridStart >= todayMonday);
    assert.equal(model.interactionStart, model.todayIso);
    assert.ok(!model.gridStart.startsWith("1999"));
  });

  it("paints overnight return arrival on the landing day", () => {
    const state = baseState();
    state.basics.startDate = "2026-12-04";
    state.basics.endDate = "2026-12-22";
    state.basics.departureCity = "Christchurch, New Zealand";
    state.basics.returnCity = "Christchurch, New Zealand";
    state.returnLegs = [
      {
        id: newId(),
        transportType: "plane",
        bookingStatus: "booked",
        travelDate: "2026-12-21",
        arrivalDate: "2026-12-22",
        departureTime: "20:00",
        arrivalTime: "10:00",
        fromCity: "Tokyo, Japan",
        toCity: "Christchurch, New Zealand",
        fromStation: null,
        toStation: null,
        operator: null,
        referenceNumber: null,
        flightNumber: "NZ123",
        notes: null,
      },
    ];
    state.dayPlacesByGroupId.g1 = [
      {
        date: "2026-12-21",
        primaryCity: "Tokyo, Japan",
        secondaryCity: "Christchurch, New Zealand",
        primaryShare: 0.5,
        dayType: "travel",
        includeBuffer: false,
      },
    ];

    const graph = setupStateToGraph("t1", state);
    const model = buildCalendarRenderModel(graph);
    const dec22 = model.transitByDate.get("2026-12-22") ?? [];
    assert.ok(
      dec22.some((overlay) => overlay.label === "Arrive in Christchurch"),
      `expected arrival overlay on 2026-12-22, got ${JSON.stringify(dec22)}`,
    );
  });
});
