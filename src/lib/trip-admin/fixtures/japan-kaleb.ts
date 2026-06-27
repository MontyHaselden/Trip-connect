import { setupStateToGraph } from "@/lib/trip-engine/adapters";
import { applyCommands } from "@/lib/trip-engine/apply-commands";
import { expandCommandsForCalendarLens } from "@/lib/trip-engine/calendar-lens-dispatch";
import type { RosterSummary, TripEntityGraph } from "@/lib/trip-engine/types";
import type { TripSetupState } from "@/lib/host/setup/types";

function japanBasics(): TripSetupState["basics"] {
  return {
    name: "Japan 2026",
    schoolName: "",
    startDate: "2026-12-05",
    endDate: "2026-12-21",
    timezone: "Asia/Tokyo",
    departureCity: "Christchurch",
    returnCity: "Christchurch",
    defaultDepartureAirport: "",
    destinationCountries: ["Japan"],
  };
}

function japanGroupsWithKaleb(): TripSetupState["groups"] {
  return [
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
      id: "g-kaleb",
      name: "Kaleb",
      type: "split_travel",
      description: null,
      sortOrder: 1,
      isMain: false,
      inheritMode: "overlay",
      personalForParticipantId: "p-kaleb",
    },
  ];
}

function japanPartyGroups(): TripSetupState["groups"] {
  return [
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
    {
      id: "g-mia",
      name: "Mia",
      type: "split_travel",
      description: null,
      sortOrder: 3,
      isMain: false,
      inheritMode: "overlay",
      personalForParticipantId: "p-mia",
    },
    {
      id: "g-trenuela",
      name: "Trenuela",
      type: "split_travel",
      description: null,
      sortOrder: 4,
      isMain: false,
      inheritMode: "overlay",
      personalForParticipantId: "p-trenuela",
    },
  ];
}

function emptyJapanState(groups: TripSetupState["groups"]): TripSetupState {
  const dayPlacesByGroupId: TripSetupState["dayPlacesByGroupId"] = { "g-main": [] };
  for (const group of groups) {
    if (group.id !== "g-main") dayPlacesByGroupId[group.id] = [];
  }

  return {
    basics: japanBasics(),
    mainGroupId: "g-main",
    groups,
    dayPlacesByGroupId,
    outboundLegs: [],
    returnLegs: [],
    intercityLegs: [],
    accommodationStays: [],
    activities: [],
    overlayOps: [],
  };
}

const MAIN_CORRIDOR_PAINTS = [
  { rangeStart: "2026-12-05", rangeEnd: "2026-12-06", location: "Tokyo" },
  { rangeStart: "2026-12-06", rangeEnd: "2026-12-09", location: "Kagoshima" },
  { rangeStart: "2026-12-09", rangeEnd: "2026-12-12", location: "Hiroshima" },
  { rangeStart: "2026-12-12", rangeEnd: "2026-12-16", location: "Kyoto" },
  { rangeStart: "2026-12-16", rangeEnd: "2026-12-21", location: "Tokyo" },
] as const;

function paintMainCorridor(graph: TripEntityGraph): TripEntityGraph {
  let next = graph;
  for (const paint of MAIN_CORRIDOR_PAINTS) {
    next = applyCommands(next, [
      {
        type: "paintDayRange",
        groupId: graph.mainGroupId,
        rangeStart: paint.rangeStart,
        rangeEnd: paint.rangeEnd,
        location: paint.location,
      },
    ]).graph;
  }
  return next;
}

export function japanKalebRoster(): RosterSummary {
  return {
    participants: [
      {
        id: "p-kaleb",
        fullName: "Kaleb",
        role: "student",
        groupIds: ["g-main"],
        inCostSplit: true,
        roomId: null,
      },
    ],
    groups: [],
    rooms: [],
  };
}

export function japanPartyRoster(): RosterSummary {
  return {
    participants: [
      { id: "p-amanda", fullName: "Amanda", role: "student", groupIds: ["g-main"], inCostSplit: true, roomId: null },
      { id: "p-kaleb", fullName: "Kaleb", role: "student", groupIds: ["g-main"], inCostSplit: true, roomId: null },
      { id: "p-mia", fullName: "Mia", role: "student", groupIds: ["g-main"], inCostSplit: true, roomId: null },
      { id: "p-trenuela", fullName: "Trenuela", role: "student", groupIds: ["g-main"], inCostSplit: true, roomId: null },
    ],
    groups: [],
    rooms: [],
  };
}

/** Main Japan corridor (Dec 5–21) with Kaleb personal overlay group. */
export function buildJapanKalebGraph(): TripEntityGraph {
  const graph = setupStateToGraph("trip-japan", emptyJapanState(japanGroupsWithKaleb()));
  return paintMainCorridor(graph);
}

export function paintKalebTottoriFork(graph: TripEntityGraph): TripEntityGraph {
  return applyCommands(graph, [
    {
      type: "paintDayRange",
      groupId: "g-kaleb",
      rangeStart: "2026-12-06",
      rangeEnd: "2026-12-13",
      location: "Tottori",
      startHalf: "right",
      endHalf: "full",
    },
  ]).graph;
}

/** Party of four with personal overlay groups. */
export function buildJapanPartyGraph(): TripEntityGraph {
  const graph = setupStateToGraph("trip-japan-party", emptyJapanState(japanPartyGroups()));
  return paintMainCorridor(graph);
}

export function paintPartyTottoriFork(
  graph: TripEntityGraph,
  roster: RosterSummary,
): TripEntityGraph {
  const commands = expandCommandsForCalendarLens(
    [
      {
        type: "paintDayRange",
        groupId: "g-amanda",
        rangeStart: "2026-12-06",
        rangeEnd: "2026-12-13",
        location: "Tottori",
        startHalf: "right",
        endHalf: "full",
      },
    ],
    {
      kind: "party",
      participantIds: ["p-amanda", "p-kaleb", "p-mia", "p-trenuela"],
    },
    graph,
    roster,
  );
  return applyCommands(graph, commands).graph;
}

export function addMainTokyoKagoshimaLeg(graph: TripEntityGraph): TripEntityGraph {
  return applyCommands(graph, [
    {
      type: "addTransportLeg",
      groupId: graph.mainGroupId,
      bucket: "intercity",
      leg: {
        id: "leg-tokyo-kagoshima",
        transportType: "train",
        bookingStatus: "not_booked",
        travelDate: "2026-12-06",
        arrivalDate: null,
        departureTime: null,
        arrivalTime: null,
        fromCity: "Tokyo",
        toCity: "Kagoshima",
        fromStation: null,
        toStation: null,
        operator: null,
        referenceNumber: null,
        flightNumber: null,
        notes: null,
        intercityFromCity: "Tokyo",
        intercityToCity: "Kagoshima",
        originGroupId: graph.mainGroupId,
        sourceEntityId: null,
      },
    },
  ]).graph;
}
