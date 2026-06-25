import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { applyCommands } from "@/lib/trip-engine/apply-commands";
import type { TripEntityGraph } from "@/lib/trip-engine/types";

function graph(): TripEntityGraph {
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

describe("transport product commands", () => {
  it("adds a product and detaches legs on remove", () => {
    const productId = "prod-1";
    const legId = "leg-1";
    const withProduct = applyCommands(graph(), [
      {
        type: "addTransportProduct",
        product: {
          id: productId,
          kind: "train_pass",
          name: "JR Pass",
          participantIds: ["p1"],
        },
      },
      {
        type: "addTransportLeg",
        groupId: "g-main",
        bucket: "intercity",
        leg: {
          id: legId,
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
          transportProductId: productId,
          billingMode: "product",
        },
      },
    ]).graph;

    assert.equal(withProduct.transportProducts.length, 1);
    assert.equal(withProduct.intercityLegs[0]?.transportProductId, productId);

    const removed = applyCommands(withProduct, [
      { type: "removeTransportProduct", productId },
    ]).graph;

    assert.equal(removed.transportProducts.length, 0);
    assert.equal(removed.intercityLegs[0]?.transportProductId, null);
    assert.equal(removed.intercityLegs[0]?.billingMode, "single");
  });
});
