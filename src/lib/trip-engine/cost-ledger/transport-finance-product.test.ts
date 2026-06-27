import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildSeedLineItems, seedItemsNotYetPresent } from "./seed-from-graph";
import type { TripEntityGraph } from "../types";

function baseGraph(): TripEntityGraph {
  return {
    tripId: "trip-1",
    basics: {
      name: "Japan",
      schoolName: "School",
      startDate: "2026-12-01",
      endDate: "2026-12-20",
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
    intercityLegs: [
      {
        id: "leg-jr",
        transportType: "train",
        bookingStatus: "not_booked",
        travelDate: "2026-12-10",
        arrivalDate: null,
        departureTime: null,
        arrivalTime: null,
        fromCity: "Tokyo",
        toCity: "Kyoto",
        fromStation: null,
        toStation: null,
        operator: null,
        referenceNumber: null,
        flightNumber: null,
        notes: null,
        intercityFromCity: "Tokyo",
        intercityToCity: "Kyoto",
        transportProductId: "prod-jr",
        billingMode: "product",
      },
      {
        id: "leg-single",
        transportType: "bus",
        bookingStatus: "not_booked",
        travelDate: "2026-12-12",
        arrivalDate: null,
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
      },
    ],
    accommodationStays: [],
    activities: [],
    transportProducts: [
      {
        id: "prod-jr",
        kind: "train_pass",
        name: "JR Pass",
        participantIds: ["p1", "p2"],
      },
    ],
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

describe("transport product finance seeding", () => {
  it("seeds one product line and skips product-linked legs", () => {
    const seeds = buildSeedLineItems(baseGraph());
    const productSeeds = seeds.filter((seed) => seed.linkedTransportProductId === "prod-jr");
    const legSeeds = seeds.filter((seed) => seed.linkedTransportLegId === "leg-jr");
    const singleSeeds = seeds.filter((seed) => seed.linkedTransportLegId === "leg-single");

    assert.equal(productSeeds.length, 1);
    assert.equal(productSeeds[0]?.description, "JR Pass");
    assert.equal(legSeeds.length, 0);
    assert.equal(singleSeeds.length, 1);
  });

  it("dedupes product seeds by linkedTransportProductId", () => {
    const seeds = buildSeedLineItems(baseGraph());
    const existing = seeds.map((seed, index) => ({
      ...seed,
      id: `line-${index}`,
    }));
    const next = seedItemsNotYetPresent(existing, seeds);
    assert.equal(next.length, 0);
  });

  it("collapses identical personal transport legs into one finance seed", () => {
    const graph = baseGraph();
    graph.intercityLegs.push(
      {
        id: "leg-personal-a",
        transportType: "plane",
        bookingStatus: "not_booked",
        travelDate: "2026-12-11",
        arrivalDate: null,
        departureTime: null,
        arrivalTime: null,
        fromCity: "Tokyo",
        toCity: "Tottori",
        fromStation: null,
        toStation: null,
        operator: null,
        referenceNumber: null,
        flightNumber: "JL123",
        notes: null,
        intercityFromCity: "Tokyo",
        intercityToCity: "Tottori",
        originGroupId: "g-a",
      },
      {
        id: "leg-personal-b",
        transportType: "plane",
        bookingStatus: "not_booked",
        travelDate: "2026-12-11",
        arrivalDate: null,
        departureTime: null,
        arrivalTime: null,
        fromCity: "Tokyo",
        toCity: "Tottori",
        fromStation: null,
        toStation: null,
        operator: null,
        referenceNumber: null,
        flightNumber: "JL123",
        notes: null,
        intercityFromCity: "Tokyo",
        intercityToCity: "Tottori",
        originGroupId: "g-b",
      },
    );

    const seeds = buildSeedLineItems(graph).filter(
      (seed) => seed.linkedTransportLegId?.startsWith("leg-personal-"),
    );
    const linkedIds = seeds.map((seed) => seed.linkedTransportLegId).sort();
    assert.deepEqual(linkedIds, ["leg-personal-a"]);
  });
});
