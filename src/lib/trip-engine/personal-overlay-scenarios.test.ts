import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { setupStateToGraph } from "./adapters";
import { applyCommands } from "./apply-commands";
import { expandCommandsForCalendarLens } from "./calendar-lens-dispatch";
import { participantInheritsMainCalendar, planModeLabel } from "./person-lens";
import { pendingTransportNeedsFromCalendar } from "./pending-city-moves";
import { projectCalendar } from "./project-calendar";
import type { RosterSummary, TripEntityGraph } from "./types";

const PARTY_IDS = ["p-amanda", "p-kaleb", "p-mia", "p-trenuela"] as const;
const PARTY_GROUPS = ["g-amanda", "g-kaleb", "g-mia", "g-trenuela"] as const;

function partyRoster(): RosterSummary {
  return {
    participants: [
      { id: "p-amanda", fullName: "Amanda", role: "student", groupIds: ["g-main"], roomId: null, inCostSplit: true },
      { id: "p-kaleb", fullName: "Kaleb", role: "student", groupIds: ["g-main"], roomId: null, inCostSplit: true },
      { id: "p-mia", fullName: "Mia", role: "student", groupIds: ["g-main"], roomId: null, inCostSplit: true },
      { id: "p-trenuela", fullName: "Trenuela", role: "student", groupIds: ["g-main"], roomId: null, inCostSplit: true },
    ],
    groups: [],
    rooms: [],
  };
}

function japanPartyGraph(): TripEntityGraph {
  return setupStateToGraph("trip-japan", {
    basics: {
      name: "Japan 2026",
      schoolName: "",
      startDate: "2026-12-05",
      endDate: "2026-12-21",
      timezone: "Asia/Tokyo",
      departureCity: "Christchurch",
      returnCity: "Christchurch",
      defaultDepartureAirport: "CHC",
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
      ...PARTY_GROUPS.map((id, index) => ({
        id,
        name: id.slice(2),
        type: "split_travel" as const,
        description: null,
        sortOrder: index + 1,
        isMain: false,
        inheritMode: "overlay" as const,
        personalForParticipantId: id.replace(/^g-/, "p-"),
      })),
    ],
    dayPlacesByGroupId: {
      "g-main": [
        { date: "2026-12-05", primaryCity: "Tokyo", secondaryCity: null, primaryShare: 1, dayType: "trip", includeBuffer: false },
        { date: "2026-12-06", primaryCity: "Tokyo", secondaryCity: "Kagoshima", primaryShare: 0.5, dayType: "trip", includeBuffer: false },
        { date: "2026-12-07", primaryCity: "Kagoshima", secondaryCity: null, primaryShare: 1, dayType: "trip", includeBuffer: false },
        { date: "2026-12-12", primaryCity: "Kagoshima", secondaryCity: null, primaryShare: 1, dayType: "trip", includeBuffer: false },
        { date: "2026-12-13", primaryCity: "Kagoshima", secondaryCity: "Hiroshima", primaryShare: 0.5, dayType: "trip", includeBuffer: false },
        { date: "2026-12-14", primaryCity: "Hiroshima", secondaryCity: null, primaryShare: 1, dayType: "trip", includeBuffer: false },
        { date: "2026-12-15", primaryCity: "Hiroshima", secondaryCity: "Kyoto", primaryShare: 0.5, dayType: "trip", includeBuffer: false },
        { date: "2026-12-18", primaryCity: "Kyoto", secondaryCity: "Tokyo", primaryShare: 0.5, dayType: "trip", includeBuffer: false },
        { date: "2026-12-21", primaryCity: "Tokyo", secondaryCity: "Christchurch", primaryShare: 0.5, dayType: "trip", includeBuffer: false },
      ],
      "g-amanda": [
        { date: "2026-12-06", primaryCity: "Tokyo", secondaryCity: "Tottori", primaryShare: 0.5, dayType: "trip", includeBuffer: false },
        { date: "2026-12-12", primaryCity: "Tottori", secondaryCity: null, primaryShare: 1, dayType: "trip", includeBuffer: false },
      ],
      "g-kaleb": [
        { date: "2026-12-07", primaryCity: "Tokyo", secondaryCity: "Tottori", primaryShare: 0.5, dayType: "trip", includeBuffer: false },
        { date: "2026-12-12", primaryCity: "Tottori", secondaryCity: null, primaryShare: 1, dayType: "trip", includeBuffer: false },
      ],
      "g-mia": [],
      "g-trenuela": [
        { date: "2026-12-06", primaryCity: "Tokyo", secondaryCity: "Tottori", primaryShare: 0.5, dayType: "trip", includeBuffer: false },
        { date: "2026-12-12", primaryCity: "Tottori", secondaryCity: null, primaryShare: 1, dayType: "trip", includeBuffer: false },
      ],
    },
    outboundLegs: [
      {
        id: "out-main",
        transportType: "plane",
        bookingStatus: "booked",
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
      },
    ],
    returnLegs: [
      {
        id: "ret-main",
        transportType: "plane",
        bookingStatus: "booked",
        travelDate: "2026-12-21",
        arrivalDate: "2026-12-21",
        departureTime: null,
        arrivalTime: null,
        fromCity: "Tokyo",
        toCity: "Christchurch",
        fromStation: null,
        toStation: null,
        operator: null,
        referenceNumber: null,
        flightNumber: null,
        notes: null,
      },
    ],
    intercityLegs: [
      {
        id: "leg-kagoshima-hiroshima",
        transportType: "train",
        bookingStatus: "flexible",
        travelDate: "2026-12-13",
        arrivalDate: null,
        departureTime: null,
        arrivalTime: null,
        fromCity: "Kagoshima",
        toCity: "Hiroshima",
        fromStation: null,
        toStation: null,
        operator: "JR",
        referenceNumber: null,
        flightNumber: null,
        notes: null,
        intercityFromCity: "Kagoshima",
        intercityToCity: "Hiroshima",
        originGroupId: "g-main",
      },
      {
        id: "leg-hiroshima-kyoto",
        transportType: "train",
        bookingStatus: "flexible",
        travelDate: "2026-12-15",
        arrivalDate: null,
        departureTime: null,
        arrivalTime: null,
        fromCity: "Hiroshima",
        toCity: "Kyoto",
        fromStation: null,
        toStation: null,
        operator: "JR",
        referenceNumber: null,
        flightNumber: null,
        notes: null,
        intercityFromCity: "Hiroshima",
        intercityToCity: "Kyoto",
        originGroupId: "g-main",
      },
      {
        id: "leg-kyoto-tokyo",
        transportType: "train",
        bookingStatus: "flexible",
        travelDate: "2026-12-18",
        arrivalDate: null,
        departureTime: null,
        arrivalTime: null,
        fromCity: "Kyoto",
        toCity: "Tokyo",
        fromStation: null,
        toStation: null,
        operator: "JR",
        referenceNumber: null,
        flightNumber: null,
        notes: null,
        intercityFromCity: "Kyoto",
        intercityToCity: "Tokyo",
        originGroupId: "g-main",
      },
    ],
    accommodationStays: [],
    activities: [],
    overlayOps: [],
    transportProducts: [],
  });
}

function projectedDay(graph: TripEntityGraph, groupId: string, date: string) {
  return projectCalendar(graph, { groupId }).days.find((day) => day.date === date);
}

describe("personal overlay scenarios", () => {
  it("party split-day save projects the same handoff for every traveller", () => {
    const graph = japanPartyGraph();
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
    const commands = expandCommandsForCalendarLens(
      [{ type: "setDayPlaces", groupId: "g-amanda", days: patch }],
      { kind: "party", participantIds: [...PARTY_IDS] },
      graph,
      partyRoster(),
    );
    const result = applyCommands(graph, commands).graph;

    for (const groupId of PARTY_GROUPS) {
      const day = projectedDay(result, groupId, "2026-12-13");
      assert.equal(day?.primaryCity, "Tottori", groupId);
      assert.equal(day?.secondaryCity, "Hiroshima", groupId);
    }
  });

  it("resetGroupFromMain matches the main calendar and main transport coverage", () => {
    const graph = japanPartyGraph();
    const reset = applyCommands(graph, [
      { type: "resetGroupFromMain", groupId: "g-mia" },
    ]).graph;

    assert.equal(planModeLabel(reset, "p-mia"), "following_main");
    assert.equal(participantInheritsMainCalendar(reset, "g-mia"), true);

    const main = projectCalendar(reset, { groupId: "g-main" }).days;
    const mia = projectCalendar(reset, { groupId: "g-mia" }).days;
    assert.deepEqual(
      mia.map((day) => ({
        date: day.date,
        primaryCity: day.primaryCity,
        secondaryCity: day.secondaryCity,
        primaryShare: day.primaryShare,
      })),
      main.map((day) => ({
        date: day.date,
        primaryCity: day.primaryCity,
        secondaryCity: day.secondaryCity,
        primaryShare: day.primaryShare,
      })),
    );

    const pending = pendingTransportNeedsFromCalendar(reset, "g-mia");
    assert.equal(
      pending.some((need) => need.kind === "outbound_flight"),
      false,
      "following main should not re-suggest outbound when main flights exist",
    );
    assert.equal(
      pending.some(
        (need) =>
          need.kind === "intercity" &&
          need.fromCity === "Kagoshima" &&
          need.toCity === "Hiroshima",
      ),
      false,
      "following main should count main JR legs",
    );
  });

  it("resetting one traveller does not change the other custom overlays", () => {
    const graph = japanPartyGraph();
    const reset = applyCommands(graph, [
      { type: "resetGroupFromMain", groupId: "g-mia" },
    ]).graph;

    const amandaBefore = projectedDay(graph, "g-amanda", "2026-12-06");
    const amandaAfter = projectedDay(reset, "g-amanda", "2026-12-06");
    assert.deepEqual(amandaAfter, amandaBefore);

    const kalebBefore = projectedDay(graph, "g-kaleb", "2026-12-07");
    const kalebAfter = projectedDay(reset, "g-kaleb", "2026-12-07");
    assert.deepEqual(kalebAfter, kalebBefore);
  });

  it("overlay travellers only surface pending gaps their calendar still needs", () => {
    const graph = japanPartyGraph();
    const pending = pendingTransportNeedsFromCalendar(graph, "g-amanda");
    assert.ok(
      pending.some(
        (need) =>
          need.kind === "intercity" &&
          need.fromCity === "Tottori" &&
          need.toCity === "Hiroshima",
      ),
      "Amanda still needs Tottori → Hiroshima",
    );
    assert.equal(
      pending.some(
        (need) =>
          need.kind === "intercity" &&
          need.fromCity === "Kagoshima" &&
          need.toCity === "Hiroshima",
      ),
      false,
      "main Kagoshima → Hiroshima should not be suggested for Amanda",
    );
  });
});
