import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { transportItineraryTitle } from "@/lib/trip-engine/transport-display";
import type { TripEntityGraph } from "@/lib/trip-engine/types";
import type { TransportLegDraft, TransportProductDraft } from "@/lib/host/wizard/types";

describe("transportItineraryTitle", () => {
  const products: TransportProductDraft[] = [
    {
      id: "jr-pass",
      kind: "train_pass",
      name: "JR Pass",
      participantIds: ["p1"],
    },
  ];

  const leg: TransportLegDraft = {
    id: "leg-1",
    transportType: "train",
    bookingStatus: "not_booked",
    travelDate: "2026-12-10",
    arrivalDate: null,
    departureTime: null,
    arrivalTime: null,
    fromCity: "Tokyo, Japan",
    toCity: "Kyoto",
    fromStation: null,
    toStation: null,
    operator: null,
    referenceNumber: null,
    flightNumber: null,
    notes: null,
    transportProductId: "jr-pass",
    billingMode: "product",
  };

  const graph = {
    tripId: "t",
    mainGroupId: "g",
    groups: [],
    dayPlacesByGroupId: {},
    accommodationStays: [],
    activities: [],
    outboundLegs: [],
    returnLegs: [],
    intercityLegs: [leg],
    transportProducts: products,
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
      schoolName: "S",
      startDate: "2026-12-01",
      endDate: "2026-12-20",
      timezone: "Asia/Tokyo",
      departureCity: "Christchurch, New Zealand",
      returnCity: "Christchurch, New Zealand",
      destinationCountries: ["Japan"],
    },
  } as TripEntityGraph;

  it("shows pass name with short city route", () => {
    assert.equal(
      transportItineraryTitle(leg, products, graph),
      "JR Pass - Tokyo → Kyoto",
    );
  });
});
