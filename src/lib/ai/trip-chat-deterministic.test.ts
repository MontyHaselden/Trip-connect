import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { setupStateToGraph } from "@/lib/trip-engine/adapters";
import type { TripSetupState } from "@/lib/host/setup/types";

import { buildClearTripProposal, buildFillGapsProposal, tryDeterministicTripChat } from "./trip-chat-deterministic";

function sparseEuropeState(): TripSetupState {
  return {
    basics: {
      name: "Europe 2026",
      schoolName: "Test School",
      startDate: "2026-07-17",
      endDate: "2026-07-21",
      timezone: "Europe/London",
      departureCity: "Christchurch",
      returnCity: "Christchurch",
      defaultDepartureAirport: null,
      destinationCountries: ["Europe"],
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
          date: "2026-07-17",
          primaryCity: "London",
          secondaryCity: null,
          primaryShare: 1,
          dayType: "trip",
          includeBuffer: false,
        },
        {
          date: "2026-07-20",
          primaryCity: "Pisa",
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

describe("buildFillGapsProposal", () => {
  it("extends single-day anchors into continuous stays", () => {
    const graph = setupStateToGraph("trip-1", sparseEuropeState());
    const proposal = buildFillGapsProposal(graph, "main-group");

    assert.equal(proposal.proposedCommands.length, 1);
    assert.equal(proposal.proposedCommands[0]?.type, "setDayPlaces");

    const days =
      proposal.proposedCommands[0]?.type === "setDayPlaces"
        ? proposal.proposedCommands[0].days
        : [];
    assert.equal(days.find((d) => d.date === "2026-07-18")?.primaryCity, "London");
    assert.equal(days.find((d) => d.date === "2026-07-19")?.primaryCity, "London");
  });
});

describe("tryDeterministicTripChat", () => {
  it("proposes clearing the whole calendar when asked to remove everything", () => {
    const graph = setupStateToGraph("trip-1", sparseEuropeState());
    const proposal = tryDeterministicTripChat("please remove everything on the calendar", graph, "main-group");

    assert.ok(proposal);
    assert.equal(proposal?.proposedCommands[0]?.type, "clearDayRange");
    assert.equal(
      proposal?.proposedCommands[0]?.type === "clearDayRange"
        ? proposal.proposedCommands[0].rangeStart
        : null,
      "2026-07-17",
    );
  });

  it("buildClearTripProposal clears the full trip window", () => {
    const graph = setupStateToGraph("trip-1", sparseEuropeState());
    const proposal = buildClearTripProposal(graph, "main-group");
    assert.equal(proposal.proposedCommands.length, 1);
    assert.equal(proposal.proposedCommands[0]?.type, "clearDayRange");
  });
});
