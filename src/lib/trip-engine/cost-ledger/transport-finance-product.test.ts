import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { TripEntityGraph } from "../types";
import {
  canonicalPersonalTransportLegId,
  duplicatePersonalTransportLegIdsForFinance,
  financeSeedTransportLegs,
} from "./transport-finance-product";

function graphWithPersonalLegs(
  legs: TripEntityGraph["intercityLegs"],
): TripEntityGraph {
  return {
    tripId: "trip-1",
    mainGroupId: "g-main",
    basics: {
      name: "Test",
      schoolName: "",
      startDate: "2026-12-05",
      endDate: "2026-12-21",
      timezone: "Pacific/Auckland",
      departureCity: "",
      returnCity: "",
      destinationCountries: ["Japan"],
    },
    outboundLegs: [],
    returnLegs: [],
    intercityLegs: legs,
    accommodationStays: [],
    activities: [],
    dayPlacesByGroupId: {},
    overlayOps: [],
    transportProducts: [],
    groups: [],
  } as TripEntityGraph;
}

describe("personal transport finance dedupe", () => {
  it("seeds one finance leg per shared personal route", () => {
    const graph = graphWithPersonalLegs([
      {
        id: "leg-b",
        transportType: "train",
        bookingStatus: "not_booked",
        travelDate: "2026-12-13",
        fromCity: "Tottori",
        toCity: "Hiroshima",
        intercityFromCity: "Tottori",
        intercityToCity: "Hiroshima",
        originGroupId: "g-kaleb",
        transportProductId: null,
        billingMode: "single",
      },
      {
        id: "leg-a",
        transportType: "train",
        bookingStatus: "not_booked",
        travelDate: "2026-12-13",
        fromCity: "Tottori, Japan",
        toCity: "Hiroshima",
        intercityFromCity: "Tottori, Japan",
        intercityToCity: "Hiroshima",
        originGroupId: "g-mia",
        transportProductId: null,
        billingMode: "single",
      },
    ]);

    const seeds = financeSeedTransportLegs(graph);
    assert.equal(seeds.length, 1);
    assert.equal(seeds[0]?.id, "leg-a");
  });

  it("marks duplicate personal leg ids for purge", () => {
    const graph = graphWithPersonalLegs([
      {
        id: "leg-a",
        transportType: "plane",
        bookingStatus: "not_booked",
        travelDate: "2026-12-06",
        fromCity: "Tokyo",
        toCity: "Tottori",
        intercityFromCity: "Tokyo",
        intercityToCity: "Tottori",
        originGroupId: "g-mia",
        transportProductId: null,
        billingMode: "single",
      },
      {
        id: "leg-b",
        transportType: "train",
        bookingStatus: "not_booked",
        travelDate: "2026-12-06",
        fromCity: "Tokyo",
        toCity: "Tottori",
        intercityFromCity: "Tokyo",
        intercityToCity: "Tottori",
        originGroupId: "g-kaleb",
        transportProductId: null,
        billingMode: "single",
      },
    ]);

    const duplicates = duplicatePersonalTransportLegIdsForFinance(graph);
    assert.equal(duplicates.has("leg-b"), true);
    assert.equal(canonicalPersonalTransportLegId(graph, "leg-b"), "leg-a");
  });
});
