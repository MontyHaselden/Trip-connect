import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { applyCommands } from "./apply-commands";
import { setupStateToGraph } from "./adapters";
import { applySetupAccommodationChange } from "@/lib/host/setup/apply-setup-accommodation";
import { computeReadiness } from "./compute-readiness";
import { detectGraphConflicts, detectStayOverlaps, detectUncoveredDays } from "./conflicts";
import { projectCalendar } from "./project-calendar";
import type { TripSetupState } from "@/lib/host/setup/types";
import { newId } from "@/lib/host/wizard/types";

function baseState(): TripSetupState {
  return {
    basics: {
      name: "Japan 2026",
      schoolName: "Test School",
      startDate: "2026-08-28",
      endDate: "2026-09-05",
      timezone: "Asia/Tokyo",
      departureCity: "Sydney",
      returnCity: "Sydney",
      defaultDepartureAirport: "SYD",
      destinationCountries: ["Japan"],
    },
    mainGroupId: "main-group",
    groups: [
      {
        id: "main-group",
        name: "Everyone",
        type: "main",
        description: null,
        sortOrder: 0,
        isMain: true,
      },
    ],
    dayPlacesByGroupId: {
      "main-group": [
        {
          date: "2026-08-28",
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

function stay(overrides: Partial<ReturnType<typeof baseState>["accommodationStays"][0]> = {}) {
  return {
    id: newId(),
    cityLabel: "Tokyo",
    stayType: "hotel" as const,
    name: "Hotel",
    url: null,
    address: null,
    phone: null,
    checkInDate: "2026-08-28",
    checkOutDate: "2026-08-30",
    notes: null,
    isHomestayGroup: false,
    multipleInCity: false,
    ...overrides,
  };
}

describe("trip-engine applyCommands", () => {
  it("updateBasics changes trip name", () => {
    const graph = setupStateToGraph("trip-1", baseState());
    const result = applyCommands(graph, [
      { type: "updateBasics", basics: { name: "Europe summer 2026" } },
    ]);
    assert.equal(result.graph.basics.name, "Europe summer 2026");
    assert.equal(result.graph.basics.timezone, "Asia/Tokyo");
  });

  it("addStay extends graph", () => {
    const graph = setupStateToGraph("trip-1", baseState());
    const result = applyCommands(graph, [
      { type: "addStay", groupId: "main-group", stay: stay({ name: "Park Hotel" }) },
    ]);
    assert.equal(result.graph.accommodationStays.length, 1);
    assert.equal(result.graph.accommodationStays[0]?.name, "Park Hotel");
  });

  it("paintDayRange applies location to range", () => {
    const state = baseState();
    state.dayPlacesByGroupId["main-group"] = [
      { date: "2026-08-28", primaryCity: "", secondaryCity: null, primaryShare: 1, dayType: "trip", includeBuffer: false },
      { date: "2026-08-29", primaryCity: "", secondaryCity: null, primaryShare: 1, dayType: "trip", includeBuffer: false },
      { date: "2026-08-30", primaryCity: "", secondaryCity: null, primaryShare: 1, dayType: "trip", includeBuffer: false },
    ];
    const graph = setupStateToGraph("trip-1", state);
    const result = applyCommands(graph, [
      {
        type: "paintDayRange",
        groupId: "main-group",
        rangeStart: "2026-08-28",
        rangeEnd: "2026-08-30",
        location: "Kyoto",
      },
    ]);
    const days = result.graph.dayPlacesByGroupId["main-group"] ?? [];
    assert.ok(days.some((d) => d.date === "2026-08-29" && d.primaryCity === "Kyoto"));
  });

  it("paintDayRange supports half-day paint on single day", () => {
    const state = baseState();
    state.dayPlacesByGroupId["main-group"] = [
      { date: "2026-08-28", primaryCity: "Kyoto", secondaryCity: null, primaryShare: 1, dayType: "trip", includeBuffer: false },
    ];
    const graph = setupStateToGraph("trip-1", state);
    const result = applyCommands(graph, [
      {
        type: "paintDayRange",
        groupId: "main-group",
        rangeStart: "2026-08-28",
        rangeEnd: "2026-08-28",
        location: "Osaka",
        startHalf: "right",
        endHalf: "right",
      },
    ]);
    const day = result.graph.dayPlacesByGroupId["main-group"]?.find((d) => d.date === "2026-08-28");
    assert.equal(day?.secondaryCity, "Osaka");
    assert.equal(day?.primaryShare, 0.5);
  });

  it("paintDayRange survives accommodation re-derive after painting over a stay", () => {
    const state = baseState();
    state.basics.startDate = "2026-07-01";
    state.basics.endDate = "2026-07-20";
    state.dayPlacesByGroupId["main-group"] = [
      { date: "2026-07-06", primaryCity: "Bangkok", secondaryCity: null, primaryShare: 1, dayType: "trip", includeBuffer: false },
      { date: "2026-07-07", primaryCity: "Bangkok", secondaryCity: null, primaryShare: 1, dayType: "trip", includeBuffer: false },
      { date: "2026-07-08", primaryCity: "Bangkok", secondaryCity: null, primaryShare: 1, dayType: "trip", includeBuffer: false },
      { date: "2026-07-09", primaryCity: "Bangkok", secondaryCity: null, primaryShare: 1, dayType: "trip", includeBuffer: false },
      { date: "2026-07-10", primaryCity: "Bangkok", secondaryCity: null, primaryShare: 0.5, dayType: "trip", includeBuffer: false },
    ];
    state.accommodationStays = [
      stay({
        cityLabel: "Bangkok",
        name: "Centre Point Plus",
        checkInDate: "2026-07-06",
        checkOutDate: "2026-07-13",
      }),
    ];
    const graph = setupStateToGraph("trip-1", state);
    const painted = applyCommands(graph, [
      {
        type: "paintDayRange",
        groupId: "main-group",
        rangeStart: "2026-07-10",
        rangeEnd: "2026-07-16",
        location: "Paris, France",
        startHalf: "right",
        endHalf: "full",
        replan: true,
      },
    ]).graph;

    assert.equal(painted.accommodationStays[0]?.checkOutDate, "2026-07-10");

    const reloaded = applySetupAccommodationChange(painted, "main-group");
    const days = reloaded.dayPlacesByGroupId["main-group"] ?? [];
    assert.ok(
      days.some(
        (d) =>
          d.date === "2026-07-12" &&
          (d.primaryCity.includes("Paris") || d.secondaryCity?.includes("Paris")),
      ),
      "Paris paint should survive reload-style stay re-derive",
    );
    assert.ok(
      !days.some((d) => d.date === "2026-07-12" && d.primaryCity === "Bangkok"),
      "Bangkok should not overwrite painted Paris nights",
    );
  });

  it("addActivity appends to activities list", () => {
    const graph = setupStateToGraph("trip-1", baseState());
    const actId = newId();
    const result = applyCommands(graph, [
      {
        type: "addActivity",
        groupId: "main-group",
        activity: {
          id: actId,
          title: "Temple visit",
          date: "2026-08-28",
          endDate: null,
          startTime: "10:00",
          endTime: "12:00",
          isTimeTbc: false,
          category: "activity",
          locationName: "Senso-ji",
          address: null,
          isLocationTbc: false,
          transportNote: null,
          leaveByTime: null,
          bringNote: null,
          description: null,
          audienceType: "everyone",
          audienceId: null,
          bookingStatus: "not_booked",
        },
      },
    ]);
    assert.equal(result.graph.activities.length, 1);
  });

  it("addTransportLeg adds intercity leg", () => {
    const graph = setupStateToGraph("trip-1", baseState());
    const result = applyCommands(graph, [
      {
        type: "addTransportLeg",
        groupId: "main-group",
        bucket: "intercity",
        leg: {
          id: newId(),
          transportType: "plane",
          bookingStatus: "flexible",
          travelDate: "2026-09-04",
          arrivalDate: "2026-09-04",
          departureTime: "21:40",
          arrivalTime: "23:00",
          fromCity: "BKK",
          toCity: "MEL",
          fromStation: "BKK",
          toStation: "MEL",
          operator: null,
          referenceNumber: null,
          flightNumber: "QF123",
          notes: null,
          intercityFromCity: "BKK",
          intercityToCity: "MEL",
        },
      },
    ]);
    assert.equal(result.graph.intercityLegs.length, 1);
    assert.equal(result.graph.intercityLegs[0]?.bookingStatus, "flexible");
  });

  it("createGroup adds non-main group", () => {
    const graph = setupStateToGraph("trip-1", baseState());
    const result = applyCommands(graph, [
      { type: "createGroup", name: "Group B", groupType: "split_travel" },
    ]);
    assert.equal(result.graph.groups.length, 2);
    assert.ok(result.graph.groups.some((g) => g.name === "Group B"));
  });
});

describe("projectCalendar with activities", () => {
  it("includes activity markers on projected day", () => {
    let graph = setupStateToGraph("trip-1", baseState());
    graph = applyCommands(graph, [
      {
        type: "addActivity",
        groupId: "main-group",
        activity: {
          id: newId(),
          title: "Temple",
          date: "2026-08-28",
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
    ]).graph;

    const projection = projectCalendar(graph);
    const day = projection.days.find((d) => d.date === "2026-08-28");
    assert.ok(day);
    assert.equal(day!.activities.length, 1);
    assert.equal(day!.activities[0]?.title, "Temple");
  });
});

describe("computeReadiness", () => {
  it("warns when accommodation missing", () => {
    const graph = setupStateToGraph("trip-1", baseState());
    const projection = projectCalendar(graph);
    const readiness = computeReadiness(graph, projection);
    const accom = readiness.find((r) => r.id === "accommodation");
    assert.equal(accom?.status, "warning");
  });

  it("mostly_complete for flexible transport", () => {
    let graph = setupStateToGraph("trip-1", baseState());
    graph = applyCommands(graph, [
      {
        type: "addTransportLeg",
        groupId: "main-group",
        bucket: "intercity",
        leg: {
          id: newId(),
          transportType: "plane",
          bookingStatus: "flexible",
          travelDate: "2026-09-04",
          arrivalDate: null,
          departureTime: "21:40",
          arrivalTime: "23:00",
          fromCity: "BKK",
          toCity: "MEL",
          fromStation: null,
          toStation: null,
          operator: null,
          referenceNumber: null,
          flightNumber: null,
          notes: null,
          intercityFromCity: "BKK",
          intercityToCity: "MEL",
        },
      },
    ]).graph;
    const projection = projectCalendar(graph);
    const readiness = computeReadiness(graph, projection);
    const transport = readiness.find((r) => r.id === "transport");
    assert.equal(transport?.status, "mostly_complete");
  });
});

describe("conflicts", () => {
  it("does not flag uncovered days when trip dates are unset", () => {
    const state = baseState();
    state.basics.startDate = "2000-01-01";
    state.basics.endDate = "2000-01-01";
    const graph = setupStateToGraph("trip-1", state);
    assert.equal(detectUncoveredDays(graph).length, 0);
    const projection = projectCalendar(graph, { groupId: graph.mainGroupId });
    assert.equal(
      detectGraphConflicts(graph, projection).find((c) => c.message.includes("2000-01-01")),
      undefined,
    );
  });

  it("detects overlapping stays", () => {
    let graph = setupStateToGraph("trip-1", baseState());
    graph = {
      ...graph,
      accommodationStays: [
        stay({ name: "A", checkInDate: "2026-08-28", checkOutDate: "2026-08-31" }),
        stay({ name: "B", checkInDate: "2026-08-30", checkOutDate: "2026-09-02" }),
      ],
    };
    const conflicts = detectStayOverlaps(graph, "main-group");
    assert.ok(conflicts.length >= 1);
  });

  it("does not flag adjacent stays that hand off on checkout morning", () => {
    let graph = setupStateToGraph("trip-1", baseState());
    graph = {
      ...graph,
      accommodationStays: [
        stay({ name: "Patong", checkInDate: "2026-08-23", checkOutDate: "2026-08-31" }),
        stay({ name: "Bangkok", checkInDate: "2026-08-31", checkOutDate: "2026-09-04" }),
      ],
    };
    assert.equal(detectStayOverlaps(graph, "main-group").length, 0);
  });

  it("does not flag overlapping stays for the same property", () => {
    let graph = setupStateToGraph("trip-1", baseState());
    graph = {
      ...graph,
      accommodationStays: [
        stay({
          name: "Royal Paradise",
          cityLabel: "Patong",
          checkInDate: "2026-08-24",
          checkOutDate: "2026-09-01",
        }),
        stay({
          id: "royal-b",
          name: "Royal Paradise",
          cityLabel: "Patong",
          checkInDate: "2026-08-24",
          checkOutDate: "2026-08-25",
        }),
      ],
    };
    assert.equal(detectStayOverlaps(graph, "main-group").length, 0);
  });

  it("does not flag checkout encoded one day after the next check-in", () => {
    let graph = setupStateToGraph("trip-1", baseState());
    graph = {
      ...graph,
      accommodationStays: [
        stay({
          name: "Royal Paradise",
          cityLabel: "Patong",
          checkInDate: "2026-08-23",
          checkOutDate: "2026-09-01",
        }),
        stay({
          name: "Centre Point",
          cityLabel: "Bangkok",
          checkInDate: "2026-08-31",
          checkOutDate: "2026-09-04",
        }),
      ],
    };
    assert.equal(detectStayOverlaps(graph, "main-group").length, 0);
  });
});
