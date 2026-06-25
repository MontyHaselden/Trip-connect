import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  defaultPairedLegId,
  flightPackagePairCandidates,
  isReverseFlightPair,
} from "./flight-package-pairs";
import type { TripEntityGraph } from "./types";

function planeLeg(
  id: string,
  from: string,
  to: string,
  date: string,
  productId?: string,
) {
  return {
    id,
    transportType: "plane" as const,
    bookingStatus: "not_booked" as const,
    travelDate: date,
    arrivalDate: date,
    departureTime: null,
    arrivalTime: null,
    fromCity: from,
    toCity: to,
    fromStation: null,
    toStation: null,
    operator: null,
    referenceNumber: null,
    flightNumber: null,
    notes: null,
    transportProductId: productId ?? null,
    billingMode: productId ? ("product" as const) : ("single" as const),
  };
}

function graphWithFlights(): TripEntityGraph {
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
    outboundLegs: [
      planeLeg("out", "Christchurch, New Zealand", "Tokyo, Japan", "2026-12-05"),
    ],
    returnLegs: [
      planeLeg("ret", "Tokyo, Japan", "Christchurch, New Zealand", "2026-12-21"),
    ],
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

describe("flight-package-pairs", () => {
  it("detects reverse flight pairs", () => {
    const graph = graphWithFlights();
    const outbound = graph.outboundLegs[0]!;
    const returnLeg = graph.returnLegs[0]!;
    assert.equal(isReverseFlightPair(outbound, returnLeg), true);
  });

  it("suggests the return leg when pairing outbound", () => {
    const graph = graphWithFlights();
    const outbound = graph.outboundLegs[0]!;
    const candidates = flightPackagePairCandidates(graph, outbound);
    assert.equal(candidates.length, 1);
    assert.equal(candidates[0]?.leg.id, "ret");
    assert.equal(defaultPairedLegId(graph, outbound), "ret");
  });
});
