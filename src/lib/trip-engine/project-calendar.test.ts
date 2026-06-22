import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { setupStateToGraph } from "./adapters";
import { projectCalendar } from "./project-calendar";
import type { TripSetupState } from "@/lib/host/setup/types";

function stateWithStay(): TripSetupState {
  return {
    basics: {
      name: "Japan",
      schoolName: "",
      startDate: "2026-08-28",
      endDate: "2026-09-02",
      timezone: "Asia/Tokyo",
      departureCity: "Sydney",
      returnCity: "Sydney",
      defaultDepartureAirport: "",
      destinationCountries: ["Japan"],
    },
    mainGroupId: "g1",
    groups: [
      {
        id: "g1",
        name: "Main",
        type: "main",
        description: null,
        sortOrder: 0,
        isMain: true,
      },
    ],
    dayPlacesByGroupId: { g1: [] },
    outboundLegs: [],
    returnLegs: [],
    intercityLegs: [],
    accommodationStays: [
      {
        id: "stay-1",
        cityLabel: "Tokyo",
        stayType: "hotel",
        name: "Grand Hotel",
        url: null,
        address: null,
        phone: null,
        checkInDate: "2026-08-28",
        checkOutDate: "2026-08-31",
        notes: null,
        isHomestayGroup: false,
        multipleInCity: false,
      },
    ],
    activities: [],
    overlayOps: [],
  };
}

describe("projectCalendar", () => {
  it("projects accommodation labels for named stays", () => {
    const graph = setupStateToGraph("trip-1", stateWithStay());
    const projection = projectCalendar(graph);

    assert.ok(projection.accommodationByDate.has("2026-08-28"));
    assert.equal(projection.accommodationByDate.get("2026-08-28"), "Grand Hotel");
    assert.ok(projection.days.length > 0);
  });

  it("personal group following main matches main day paint", () => {
    const graph = setupStateToGraph("trip-1", {
      ...stateWithStay(),
      groups: [
        {
          id: "g1",
          name: "Main",
          type: "main",
          description: null,
          sortOrder: 0,
          isMain: true,
          inheritMode: null,
          personalForParticipantId: null,
        },
        {
          id: "g-personal",
          name: "Amanda",
          type: "split_travel",
          description: null,
          sortOrder: 1,
          isMain: false,
          inheritMode: null,
          personalForParticipantId: "p-amanda",
        },
      ],
      dayPlacesByGroupId: {
        g1: [
          {
            date: "2026-08-29",
            primaryCity: "Tokyo",
            secondaryCity: "Osaka",
            primaryShare: 0.5,
            dayType: "travel",
            includeBuffer: false,
          },
        ],
        "g-personal": [],
      },
    });

    const main = projectCalendar(graph, { groupId: "g1" });
    const personal = projectCalendar(graph, { groupId: "g-personal" });

    assert.deepEqual(
      personal.days.map((d) => ({
        date: d.date,
        primaryCity: d.primaryCity,
        secondaryCity: d.secondaryCity,
        primaryShare: d.primaryShare,
      })),
      main.days.map((d) => ({
        date: d.date,
        primaryCity: d.primaryCity,
        secondaryCity: d.secondaryCity,
        primaryShare: d.primaryShare,
      })),
    );
  });
});
