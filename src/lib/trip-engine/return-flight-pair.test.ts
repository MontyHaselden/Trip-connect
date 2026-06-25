import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { findReturnFlightPairForNeed, returnFlightPackageName, returnFlightPairSummary } from "./return-flight-pair";
import type { PendingTransportNeed } from "./pending-city-moves";
import type { TripEntityGraph } from "./types";

function baseGraph(): TripEntityGraph {
  return {
    tripId: "trip-1",
    basics: {
      name: "Japan",
      schoolName: "School",
      startDate: "2026-12-05",
      endDate: "2026-12-21",
      timezone: "Asia/Tokyo",
      departureCity: "Christchurch",
      returnCity: "Christchurch",
      destinationCountries: ["Japan"],
    },
    mainGroupId: "g-main",
    groups: [],
    dayPlacesByGroupId: {},
    outboundLegs: [],
    returnLegs: [],
    intercityLegs: [],
    accommodationStays: [],
    activities: [],
    transportProducts: [],
    overlayOps: [],
    bookingsSummary: [],
    emergencySummary: {
      localEmergencyNumber: null,
      schoolEmergencyPhone: null,
      contactsCount: 0,
      phrasesCount: 0,
    },
    publishSummary: {
      publishedVersion: 0,
      viewerGalleryEnabled: false,
      viewerRoomDetailsEnabled: false,
    },
  };
}

const outbound: PendingTransportNeed = {
  kind: "outbound_flight",
  fromCity: "Christchurch",
  toCity: "Tokyo",
  date: "2026-12-05",
};

const returnNeed: PendingTransportNeed = {
  kind: "return_flight",
  fromCity: "Tokyo",
  toCity: "Christchurch",
  date: "2026-12-21",
};

describe("findReturnFlightPairForNeed", () => {
  it("pairs two pending home flights", () => {
    const pair = findReturnFlightPairForNeed(baseGraph(), "g-main", outbound, [
      outbound,
      returnNeed,
    ]);
    assert.ok(pair);
    assert.equal(pair?.kind, "pending");
    if (pair?.kind === "pending") {
      assert.equal(pair.outbound.kind, "outbound_flight");
      assert.equal(pair.return.kind, "return_flight");
    }
  });

  it("returns null when only one home flight gap exists", () => {
    const pair = findReturnFlightPairForNeed(baseGraph(), "g-main", outbound, [outbound]);
    assert.equal(pair, null);
  });

  it("returns null for intercity gaps", () => {
    const intercity: PendingTransportNeed = {
      kind: "intercity",
      fromCity: "Tokyo",
      toCity: "Kagoshima",
      date: "2026-12-06",
    };
    const pair = findReturnFlightPairForNeed(baseGraph(), "g-main", intercity, [intercity]);
    assert.equal(pair, null);
  });

  it("builds compact labels and auto package name", () => {
    const pair = findReturnFlightPairForNeed(baseGraph(), "g-main", outbound, [
      outbound,
      returnNeed,
    ]);
    assert.ok(pair);
    assert.equal(returnFlightPackageName(pair!), "CHC to Tokyo return");
    const summary = returnFlightPairSummary(pair!);
    assert.equal(summary.packageTitle, "CHC to Tokyo return");
    assert.equal(summary.outboundDate, "5 Dec");
    assert.equal(summary.outboundRoute, "CHC → Tokyo");
    assert.equal(summary.returnDate, "21 Dec");
    assert.equal(summary.returnRoute, "Tokyo → CHC");
  });
});
