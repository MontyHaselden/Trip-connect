import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { setupStateToGraph } from "../adapters";
import type { TripSetupState } from "@/lib/host/setup/types";

import { emptyCostLedgerProjection } from "./empty-projection";
import { pruneCostLedgerLinkedOrphans } from "./prune-cost-ledger-orphans";
import type { CostLineItemDraft } from "./types";

function activityLine(activityId: string): CostLineItemDraft {
  return {
    id: "line-1",
    sortOrder: 0,
    category: "activities",
    description: "USJ",
    notes: "2026-12-17",
    totalAmountCents: 0,
    currency: "NZD",
    quantity: null,
    allocationRuleType: "equal_present",
    allocationRulePayload: {},
    linkedStayId: null,
    linkedTransportLegId: null,
    linkedActivityId: activityId,
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

function emptyGraph() {
  const state: TripSetupState = {
    basics: {
      name: "Trip",
      schoolName: "School",
      startDate: "2026-12-04",
      endDate: "2026-12-22",
      timezone: "UTC",
      departureCity: "",
      returnCity: "",
      defaultDepartureAirport: null,
      destinationCountries: [],
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
    dayPlacesByGroupId: { "main-group": [] },
    outboundLegs: [],
    returnLegs: [],
    intercityLegs: [],
    accommodationStays: [],
    activities: [],
    overlayOps: [],
  };
  return setupStateToGraph("trip-1", state);
}

describe("pruneCostLedgerLinkedOrphans", () => {
  it("removes finance rows for deleted activities", () => {
    const ledger = emptyCostLedgerProjection();
    ledger.lineItems = [activityLine("act-usj")];

    const pruned = pruneCostLedgerLinkedOrphans(ledger, emptyGraph());
    assert.equal(pruned?.lineItems.length, 0);
  });
});
