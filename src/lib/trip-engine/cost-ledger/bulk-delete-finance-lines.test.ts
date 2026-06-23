import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildRemoveFromTripCommands } from "./bulk-delete-finance-lines";
import type { CostLineItemDraft } from "./types";
import type { TripEntityGraph } from "../types";

function line(id: string, stayId: string | null): CostLineItemDraft {
  return {
    id,
    sortOrder: 0,
    category: "accommodation",
    description: "Stay",
    notes: null,
    totalAmountCents: 0,
    currency: "NZD",
    quantity: null,
    allocationRuleType: "equal_cost_participants",
    allocationRulePayload: {},
    linkedStayId: stayId,
    linkedTransportLegId: null,
    linkedActivityId: null,
    scope: "presence",
    supplierPaymentStatus: null,
    costStatus: "unknown",
    linePaymentStatus: "unpaid",
    fundingStatus: "unfunded",
    supplierName: null,
    estimatedAmountCents: null,
    actualAmountCents: null,
    taxTreatment: "unknown",
    exportCategoryLabel: null,
    exportReference: null,
    bookingReference: null,
    invoiceRecorded: false,
    receiptRecorded: false,
  };
}

function graph(stayId: string): TripEntityGraph {
  return {
    tripId: "trip-1",
    basics: {
      name: "Trip",
      schoolName: "",
      startDate: "2026-12-05",
      endDate: "2026-12-21",
      timezone: "UTC",
      departureCity: "",
      returnCity: "",
      defaultDepartureAirport: "",
      destinationCountries: [],
    },
    mainGroupId: "g-main",
    groups: [],
    dayPlacesByGroupId: {},
    accommodationStays: [
      {
        id: stayId,
        cityLabel: "Tokyo",
        stayType: "hotel",
        name: "Grand Prince",
        url: null,
        address: null,
        phone: null,
        checkInDate: "2026-12-18",
        checkOutDate: "2026-12-21",
        notes: null,
        isHomestayGroup: false,
        multipleInCity: false,
        originGroupId: "g-main",
      },
    ],
    outboundLegs: [],
    returnLegs: [],
    intercityLegs: [],
    activities: [],
    overlayOps: [],
    bookingsSummary: null,
    emergencySummary: null,
    publishSummary: null,
  };
}

describe("buildRemoveFromTripCommands", () => {
  it("dedupes duplicate finance rows linked to the same stay", () => {
    const stayId = "stay-1";
    const commands = buildRemoveFromTripCommands(graph(stayId), [
      line("line-a", stayId),
      line("line-b", stayId),
    ]);
    assert.equal(commands.length, 1);
    assert.equal(commands[0]?.type, "removeStay");
  });
});
