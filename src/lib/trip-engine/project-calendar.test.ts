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

  it("location-only participant overlay keeps main logistics and explicit travel day override", () => {
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
          inheritMode: "overlay",
          personalForParticipantId: "p-amanda",
        },
      ],
      dayPlacesByGroupId: {
        g1: [
          ...["2026-08-28", "2026-08-29", "2026-08-30"].map((date) => ({
            date,
            primaryCity: "Kagoshima",
            secondaryCity: null,
            primaryShare: 1,
            dayType: "trip" as const,
            includeBuffer: false,
          })),
          {
            date: "2026-08-31",
            primaryCity: "Kagoshima",
            secondaryCity: "Tokyo",
            primaryShare: 0.5,
            dayType: "travel" as const,
            includeBuffer: false,
          },
        ],
        "g-personal": [
          ...["2026-08-28", "2026-08-29", "2026-08-30"].map((date) => ({
            date,
            primaryCity: "Tottori",
            secondaryCity: null,
            primaryShare: 1,
            dayType: "trip" as const,
            includeBuffer: false,
          })),
          {
            date: "2026-08-31",
            primaryCity: "Tottori",
            secondaryCity: "Tokyo",
            primaryShare: 0.5,
            dayType: "travel" as const,
            includeBuffer: false,
          },
        ],
      },
      intercityLegs: [
        {
          id: "leg-1",
          legKind: "city_change",
          transportType: "train",
          bookingStatus: "not_booked",
          travelDate: "2026-08-31",
          departureTime: null,
          arrivalTime: null,
          fromCity: "Kagoshima",
          toCity: "Tokyo",
          fromStation: null,
          toStation: null,
          operator: null,
          referenceNumber: null,
          flightNumber: null,
          notes: null,
          intercityFromCity: "Kagoshima",
          intercityToCity: "Tokyo",
          originGroupId: "g1",
          sourceEntityId: null,
        },
      ],
    });

    const main = projectCalendar(graph, { groupId: "g1" });
    const personal = projectCalendar(graph, { groupId: "g-personal" });
    const travelDay = personal.days.find((d) => d.date === "2026-08-31");

    assert.equal(travelDay?.primaryCity, "Tottori");
    assert.equal(travelDay?.secondaryCity, "Tokyo");
    assert.equal(travelDay?.accommodationLabel, main.days.find((d) => d.date === "2026-08-31")?.accommodationLabel);
  });

  it("surface-only intercity leg does not paint calendar transit for main group", () => {
    const graph = setupStateToGraph("trip-1", {
      ...stateWithStay(),
      dayPlacesByGroupId: {
        g1: [
          {
            date: "2026-08-29",
            primaryCity: "Kyoto",
            secondaryCity: "Osaka",
            primaryShare: 0.5,
            dayType: "travel",
            includeBuffer: false,
          },
        ],
      },
      intercityLegs: [
        {
          id: "leg-surface",
          legKind: "city_change",
          transportType: "train",
          bookingStatus: "not_booked",
          travelDate: "2026-08-29",
          departureTime: null,
          arrivalTime: null,
          fromCity: "Kyoto",
          toCity: "Osaka",
          fromStation: null,
          toStation: null,
          operator: null,
          referenceNumber: null,
          flightNumber: null,
          notes: null,
          intercityFromCity: "Kyoto",
          intercityToCity: "Osaka",
          surfaceOnly: true,
        },
      ],
    });

    const projection = projectCalendar(graph, { groupId: "g1" });
    const day = projection.days.find((d) => d.date === "2026-08-29");
    assert.equal(day?.transportOverlays?.length ?? 0, 0);
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

  it("independent personal plan does not inherit main calendar days", () => {
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
        g1: [
          {
            date: "2026-08-28",
            primaryCity: "Kagoshima",
            secondaryCity: null,
            primaryShare: 1,
            dayType: "trip",
            includeBuffer: false,
          },
        ],
        "g-macy": [],
      },
    });

    const macy = projectCalendar(graph, { groupId: "g-macy" });
    const day = macy.days.find((d) => d.date === "2026-08-28");
    assert.equal(day?.primaryCity, "");
    assert.equal(day?.accommodationLabel, null);
  });
});
