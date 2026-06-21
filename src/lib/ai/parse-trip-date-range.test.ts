import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseDayMonthRangeFromMessage, parseMonthShiftFromMessage } from "./parse-trip-date-range";
import { buildRescheduleProposal, tryDeterministicTripChat } from "./trip-chat-deterministic";
import { setupStateToGraph } from "@/lib/trip-engine/adapters";
import type { TripSetupState } from "@/lib/host/setup/types";

function baseState(): TripSetupState {
  return {
    basics: {
      name: "Europe 2026",
      schoolName: "Test School",
      startDate: "2026-07-10",
      endDate: "2026-07-30",
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
          date: "2026-07-10",
          primaryCity: "London",
          secondaryCity: null,
          primaryShare: 1,
          dayType: "trip",
          includeBuffer: false,
        },
        {
          date: "2026-07-16",
          primaryCity: "Paris",
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

describe("parseDayMonthRangeFromMessage", () => {
  it("parses 16th to 26th of july using trip year", () => {
    const range = parseDayMonthRangeFromMessage(
      "the trip is actually supposed to be the 16th to the 26th of july",
      "2026-07-10",
    );
    assert.deepEqual(range, {
      startDate: "2026-07-16",
      endDate: "2026-07-26",
    });
  });

  it("parses cross-month ranges like 16 June to 26 July", () => {
    const range = parseDayMonthRangeFromMessage(
      "The dates are actually supposed to be the 16th of JUNE to the 26th of JULY",
      "2026-07-10",
    );
    assert.deepEqual(range, {
      startDate: "2026-06-16",
      endDate: "2026-07-26",
    });
  });
});

describe("parseMonthShiftFromMessage", () => {
  it("detects move back by one month", () => {
    assert.equal(
      parseMonthShiftFromMessage(
        "Everything just needs to move back by one month. christchurch on the 15th of july should now be the 15th of june.",
      ),
      -1,
    );
  });
});

describe("tryDeterministicTripChat", () => {
  it("proposes a month shift instead of asking for dates again", () => {
    const graph = setupStateToGraph("trip-1", baseState());
    const proposal = tryDeterministicTripChat(
      "Everything just needs to move back by one month.",
      graph,
      "main-group",
    );

    assert.ok(proposal);
    assert.equal(proposal?.needsClarification, false);
    assert.deepEqual(proposal?.proposedCommands, [{ type: "shiftTripDates", deltaMonths: -1 }]);
  });
});

describe("buildRescheduleProposal", () => {
  it("proposes new trip bounds and trims early days", () => {
    const graph = setupStateToGraph("trip-1", baseState());
    const proposal = buildRescheduleProposal(
      "Change it to the 16th to the 26th of july and remove the first few days",
      graph,
      "main-group",
    );

    assert.ok(proposal);
    assert.equal(proposal?.needsClarification, false);
    assert.ok(proposal?.proposedCommands.some((command) => command.type === "setTripDateRange"));
    const rangeCommand = proposal?.proposedCommands.find(
      (command) => command.type === "setTripDateRange",
    );
    if (rangeCommand?.type === "setTripDateRange") {
      assert.equal(rangeCommand.startDate, "2026-07-16");
      assert.equal(rangeCommand.endDate, "2026-07-26");
    }
  });
});
