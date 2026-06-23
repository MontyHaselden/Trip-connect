import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { defaultCostLineFinanceFields } from "./finance-metadata";

import { planModeLabel } from "../person-lens";
import type { TripEntityGraph } from "../types";

function miniGraph(): TripEntityGraph {
  return {
    tripId: "trip-1",
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
      {
        id: "monty",
        name: "Monty",
        type: "split_travel",
        description: null,
        sortOrder: 1,
        isMain: false,
        inheritMode: "independent",
        personalForParticipantId: "p-monty",
      },
    ],
    dayPlacesByGroupId: {
      main: [
        { date: "2026-12-10", primaryCity: "Tokyo", secondaryCity: null, primaryShare: 1, dayType: "trip", includeBuffer: false },
      ],
      monty: [
        { date: "2026-12-10", primaryCity: "Nagoya", secondaryCity: null, primaryShare: 1, dayType: "trip", includeBuffer: false },
      ],
    },
    accommodationStays: [
      {
        id: "stay-tokyo",
        name: "Tokyo Hotel",
        cityLabel: "Tokyo",
        checkInDate: "2026-12-10",
        checkOutDate: "2026-12-12",
        stayType: "hotel",
        originGroupId: "main",
      } as TripEntityGraph["accommodationStays"][number],
    ],
    outboundLegs: [],
    returnLegs: [],
    intercityLegs: [],
    activities: [],
    overlayOps: [],
    bookingsSummary: [],
    emergencySummary: { localEmergencyNumber: null, schoolEmergencyPhone: null, contactsCount: 0, phrasesCount: 0 },
    publishSummary: { publishedVersion: 0, viewerGalleryEnabled: false, viewerRoomDetailsEnabled: false },
    basics: {
      name: "Trip",
      schoolName: "School",
      startDate: "2026-12-10",
      endDate: "2026-12-20",
      timezone: "Asia/Tokyo",
      departureCity: "",
      returnCity: "",
      defaultDepartureAirport: null,
      destinationCountries: [],
    },
  } as TripEntityGraph;
}

describe("planModeLabel", () => {
  it("detects independent personal plan", () => {
    const graph = miniGraph();
    assert.equal(planModeLabel(graph, "p-monty"), "custom_independent");
    assert.equal(planModeLabel(graph, "p-other"), "following_main");
  });
});

describe("presence eligibility", () => {
  it("excludes independent participant from main stay", async () => {
    const { buildParticipantPresenceMap, eligibleParticipantIdsForLine } = await import(
      "./presence"
    );
    const graph = miniGraph();
    const roster = {
      participants: [
        { id: "p-monty", fullName: "Monty", role: "student", inCostSplit: true, groupIds: ["monty"], roomId: null },
        { id: "p-sam", fullName: "Sam", role: "student", inCostSplit: true, groupIds: [], roomId: null },
      ],
      groups: [{ id: "monty", name: "Monty" }],
      rooms: [],
    };
    const presence = buildParticipantPresenceMap(graph, roster);
    const line = {
      id: "line-1",
      sortOrder: 0,
      category: "accommodation" as const,
      description: "Tokyo Hotel",
      notes: null,
      totalAmountCents: 10000,
      currency: "NZD",
      quantity: null,
      allocationRuleType: "equal_present" as const,
      allocationRulePayload: {},
      linkedStayId: "stay-tokyo",
      linkedTransportLegId: null,
      linkedActivityId: null,
      scope: "presence" as const,
      supplierPaymentStatus: null,
      ...defaultCostLineFinanceFields(),
    };
    const eligible = eligibleParticipantIdsForLine(line, graph, roster, presence);
    assert.ok(eligible.includes("p-sam"));
    assert.ok(!eligible.includes("p-monty"));
  });

  it("only includes participants whose calendar follows an intercity leg", async () => {
    const { buildParticipantPresenceMap, eligibleParticipantIdsForLine } = await import(
      "./presence"
    );
    const graph = {
      ...miniGraph(),
      dayPlacesByGroupId: {
        main: [
          {
            date: "2026-12-06",
            primaryCity: "Kagoshima",
            secondaryCity: null,
            primaryShare: 1,
            dayType: "trip",
            includeBuffer: false,
          },
          {
            date: "2026-12-07",
            primaryCity: "Kagoshima",
            secondaryCity: null,
            primaryShare: 1,
            dayType: "trip",
            includeBuffer: false,
          },
        ],
        monty: [
          {
            date: "2026-12-07",
            primaryCity: "Tottori",
            secondaryCity: null,
            primaryShare: 1,
            dayType: "trip",
            includeBuffer: false,
          },
        ],
      },
      intercityLegs: [
        {
          id: "leg-kag-tottori",
          transportType: "train",
          bookingStatus: "planned",
          travelDate: "2026-12-07",
          arrivalDate: null,
          departureTime: null,
          arrivalTime: null,
          fromCity: "Kagoshima",
          toCity: "Tottori",
          intercityFromCity: "Kagoshima",
          intercityToCity: "Tottori",
          fromStation: null,
          toStation: null,
          operator: null,
          referenceNumber: null,
          flightNumber: null,
          notes: null,
          originGroupId: "main",
        },
      ],
    } as TripEntityGraph;
    const roster = {
      participants: [
        {
          id: "p-amanda",
          fullName: "Amanda",
          role: "student",
          inCostSplit: true,
          groupIds: ["monty"],
          roomId: null,
        },
        {
          id: "p-sam",
          fullName: "Sam",
          role: "student",
          inCostSplit: true,
          groupIds: ["main"],
          roomId: null,
        },
      ],
      groups: [
        { id: "main", name: "Main" },
        { id: "monty", name: "Amanda" },
      ],
      rooms: [],
    };
    const presence = buildParticipantPresenceMap(graph, roster);
    const line = {
      id: "line-transport",
      sortOrder: 0,
      category: "transport" as const,
      description: "Kagoshima -> Tottori",
      notes: null,
      totalAmountCents: 0,
      currency: "NZD",
      quantity: null,
      allocationRuleType: "equal_present" as const,
      allocationRulePayload: {},
      linkedStayId: null,
      linkedTransportLegId: "leg-kag-tottori",
      linkedActivityId: null,
      scope: "presence" as const,
      supplierPaymentStatus: null,
      ...defaultCostLineFinanceFields(),
    };
    const eligible = eligibleParticipantIdsForLine(line, graph, roster, presence);
    assert.ok(eligible.includes("p-amanda"));
    assert.ok(!eligible.includes("p-sam"));
  });
});
