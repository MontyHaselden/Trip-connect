import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  formatTransportPlace,
  transportLabelContextFromBasics,
  transportLegRouteLabel,
  transportRouteLabel,
} from "./transport-route-label";
import type { TripEntityGraph } from "./types";

function japanGraph(
  legs: Partial<Pick<TripEntityGraph, "outboundLegs" | "returnLegs" | "intercityLegs">>,
): TripEntityGraph {
  return {
    tripId: "trip-1",
    mainGroupId: "g-main",
    groups: [],
    dayPlacesByGroupId: {},
    accommodationStays: [],
    activities: [],
    outboundLegs: legs.outboundLegs ?? [],
    returnLegs: legs.returnLegs ?? [],
    intercityLegs: legs.intercityLegs ?? [],
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
    basics: {
      name: "Japan",
      schoolName: "School",
      startDate: "2026-12-05",
      endDate: "2026-12-21",
      timezone: "Asia/Tokyo",
      departureCity: "Christchurch, New Zealand",
      returnCity: "Christchurch, New Zealand",
      destinationCountries: ["Japan"],
    },
  };
}

describe("transport-route-label", () => {
  it("drops Japan suffix on domestic intercity legs", () => {
    const ctx = transportLabelContextFromBasics({
      departureCity: "Christchurch, New Zealand",
      destinationCountries: ["Japan"],
    });
    assert.equal(
      formatTransportPlace("Tokyo, Japan", ctx),
      "Tokyo",
    );
    assert.equal(
      transportRouteLabel({
        from: "Tokyo, Japan",
        to: "Kagoshima, Japan",
        date: "2026-12-06",
        ctx,
      }),
      "Tokyo → Kagoshima",
    );
  });

  it("drops home country on outbound legs", () => {
    const graph = japanGraph({
      intercityLegs: [
        {
          id: "leg-1",
          transportType: "plane",
          bookingStatus: "placeholder",
          travelDate: "2026-12-06",
          arrivalDate: "2026-12-06",
          departureTime: null,
          arrivalTime: null,
          fromCity: "Christchurch, New Zealand",
          toCity: "Tokyo, Japan",
          fromStation: "Christchurch, New Zealand",
          toStation: "Tokyo, Japan",
          operator: null,
          referenceNumber: null,
          flightNumber: null,
          notes: null,
          intercityFromCity: "Christchurch, New Zealand",
          intercityToCity: "Tokyo, Japan",
          originGroupId: "g-main",
          sourceEntityId: null,
        },
      ],
    });
    assert.equal(
      transportLegRouteLabel(graph.intercityLegs[0]!, graph),
      "Christchurch → Tokyo",
    );
  });

  it("prefixes date only when the same route appears more than once", () => {
    const graph = japanGraph({
      intercityLegs: [
        {
          id: "leg-1",
          transportType: "train",
          bookingStatus: "flexible",
          travelDate: "2026-12-06",
          arrivalDate: "2026-12-06",
          departureTime: null,
          arrivalTime: null,
          fromCity: "Tokyo, Japan",
          toCity: "Kagoshima, Japan",
          fromStation: "Tokyo, Japan",
          toStation: "Kagoshima, Japan",
          operator: null,
          referenceNumber: null,
          flightNumber: null,
          notes: null,
          intercityFromCity: "Tokyo, Japan",
          intercityToCity: "Kagoshima, Japan",
          originGroupId: "g-main",
          sourceEntityId: null,
        },
        {
          id: "leg-2",
          transportType: "train",
          bookingStatus: "flexible",
          travelDate: "2026-12-20",
          arrivalDate: "2026-12-20",
          departureTime: null,
          arrivalTime: null,
          fromCity: "Tokyo, Japan",
          toCity: "Kagoshima, Japan",
          fromStation: "Tokyo, Japan",
          toStation: "Kagoshima, Japan",
          operator: null,
          referenceNumber: null,
          flightNumber: null,
          notes: null,
          intercityFromCity: "Tokyo, Japan",
          intercityToCity: "Kagoshima, Japan",
          originGroupId: "g-main",
          sourceEntityId: null,
        },
      ],
    });
    assert.equal(
      transportLegRouteLabel(graph.intercityLegs[0]!, graph),
      "2026-12-06: Tokyo → Kagoshima",
    );
    assert.equal(
      transportLegRouteLabel(graph.intercityLegs[1]!, graph),
      "2026-12-20: Tokyo → Kagoshima",
    );
  });
});
