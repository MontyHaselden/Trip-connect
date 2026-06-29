import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { applyCommands } from "./apply-commands";
import { resetPersonalGroupFromMain } from "./reset-personal-group-from-main";
import type { TripEntityGraph } from "./types";

function graphWithPersonalOverlay(): TripEntityGraph {
  return {
    tripId: "trip-1",
    mainGroupId: "main",
    basics: {
      name: "Japan",
      schoolName: "",
      startDate: "2026-12-05",
      endDate: "2026-12-22",
      timezone: "Asia/Tokyo",
      departureCity: "Christchurch",
      returnCity: "Christchurch",
      defaultDepartureAirport: "",
      destinationCountries: ["Japan"],
    },
    groups: [
      {
        id: "main",
        name: "Main",
        type: "main",
        description: null,
        sortOrder: 0,
        isMain: true,
        inheritMode: null,
        personalForParticipantId: null,
      },
      {
        id: "personal-amanda",
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
      main: [
        {
          date: "2026-12-18",
          primaryCity: "Kyoto",
          secondaryCity: "Tokyo",
          primaryShare: 0.5,
          dayType: "travel",
          includeBuffer: false,
        },
      ],
      "personal-amanda": [
        {
          date: "2026-12-18",
          primaryCity: "",
          secondaryCity: "Tokyo",
          primaryShare: 0.5,
          dayType: "trip",
          includeBuffer: false,
        },
      ],
    },
    outboundLegs: [],
    returnLegs: [],
    intercityLegs: [],
    accommodationStays: [
      {
        id: "stay-main",
        cityLabel: "Kyoto",
        stayType: "hotel",
        name: "VIA INN",
        url: null,
        address: null,
        phone: null,
        googlePlaceId: null,
        latitude: null,
        longitude: null,
        checkInDate: "2026-12-15",
        checkOutDate: "2026-12-18",
        notes: null,
        isHomestayGroup: false,
        originGroupId: "main",
        audienceType: "everyone",
        audienceId: null,
      },
      {
        id: "stay-personal",
        cityLabel: "Tokyo",
        stayType: "hotel",
        name: "Other hotel",
        url: null,
        address: null,
        phone: null,
        googlePlaceId: null,
        latitude: null,
        longitude: null,
        checkInDate: "2026-12-18",
        checkOutDate: "2026-12-22",
        notes: null,
        isHomestayGroup: false,
        originGroupId: "personal-amanda",
        audienceType: "everyone",
        audienceId: null,
      },
    ],
    activities: [
      {
        id: "act-personal",
        title: "Solo activity",
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
        originGroupId: "personal-amanda",
      },
    ],
    overlayOps: [
      {
        id: "hide-main-stay",
        groupId: "personal-amanda",
        entityType: "accommodation_stay",
        baseEntityId: "stay-main",
        op: "hide",
        replacementEntityId: null,
        effectiveFrom: "2026-12-18",
        effectiveTo: "2026-12-22",
      },
    ],
  };
}

describe("resetGroupFromMain", () => {
  it("clears personal overrides but preserves main group plan data", () => {
    const before = graphWithPersonalOverlay();
    const mainDays = structuredClone(before.dayPlacesByGroupId.main);
    const mainStays = before.accommodationStays.filter((s) => s.originGroupId === "main");

    const { graph } = applyCommands(before, [
      { type: "resetGroupFromMain", groupId: "personal-amanda" },
    ]);

    assert.deepEqual(graph.dayPlacesByGroupId.main, mainDays);
    assert.equal(graph.dayPlacesByGroupId["personal-amanda"]?.length, 0);
    assert.equal(
      graph.accommodationStays.filter((s) => s.originGroupId === "main").length,
      mainStays.length,
    );
    assert.ok(!graph.accommodationStays.some((s) => s.originGroupId === "personal-amanda"));
    assert.ok(!graph.activities.some((a) => a.originGroupId === "personal-amanda"));
    assert.ok(!graph.overlayOps.some((o) => o.groupId === "personal-amanda"));
    assert.equal(
      graph.groups.find((g) => g.id === "personal-amanda")?.inheritMode,
      null,
    );
  });

  it("clears personal outbound legs and hidden pending keys for the group", () => {
    const before = graphWithPersonalOverlay();
    const withExtras: TripEntityGraph = {
      ...before,
      outboundLegs: [
        ...before.outboundLegs,
        {
          id: "out-personal",
          transportType: "plane",
          bookingStatus: "placeholder",
          travelDate: "2026-12-05",
          arrivalDate: "2026-12-05",
          departureTime: null,
          arrivalTime: null,
          fromCity: "Christchurch",
          toCity: "Tokyo",
          fromStation: null,
          toStation: null,
          operator: null,
          referenceNumber: null,
          flightNumber: null,
          notes: null,
          originGroupId: "personal-amanda",
        },
      ],
      hiddenPendingTransportNeedKeys: [
        "personal-amanda|intercity|2026-12-18|kyoto|tokyo",
        "main|intercity|2026-12-18|kyoto|tokyo",
      ],
    };

    const graph = resetPersonalGroupFromMain(withExtras, "personal-amanda");
    assert.ok(!graph.outboundLegs.some((leg) => leg.originGroupId === "personal-amanda"));
    assert.ok(
      !graph.hiddenPendingTransportNeedKeys?.some((key) =>
        key.startsWith("personal-amanda|"),
      ),
    );
    assert.ok(
      graph.hiddenPendingTransportNeedKeys?.some((key) => key.startsWith("main|")),
    );
  });
});
