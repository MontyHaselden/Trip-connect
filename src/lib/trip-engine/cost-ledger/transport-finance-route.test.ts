import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  financeLinkBucketKey,
  personalTransportRouteFinanceKey,
  transportLegIdsSharingRoute,
  transportRouteAlreadySeededInLedger,
} from "./transport-finance-route";
import { seedItemsNotYetPresent } from "./seed-from-graph";
import type { CostLineItemDraft } from "./types";
import type { TripEntityGraph } from "../types";

function line(partial: Partial<CostLineItemDraft>): CostLineItemDraft {
  return {
    id: "line-1",
    description: "Train",
    category: "transport",
    notes: null,
    quantity: null,
    totalAmountCents: 0,
    currency: "NZD",
    allocationRuleType: "equal_present",
    allocationRulePayload: {},
    linkedStayId: null,
    linkedTransportLegId: "leg-a",
    linkedTransportProductId: null,
    linkedActivityId: null,
    scope: "presence",
    sortOrder: 0,
    supplierPaymentStatus: null,
    costStatus: "estimated",
    linePaymentStatus: "unpaid",
    fundingStatus: "unfunded",
    supplierName: null,
    estimatedAmountCents: null,
    actualAmountCents: null,
    taxTreatment: null,
    exportCategoryLabel: null,
    exportReference: null,
    bookingReference: null,
    invoiceRecorded: false,
    receiptRecorded: false,
    ...partial,
  };
}

describe("transport finance route keys", () => {
  const graph = {
    mainGroupId: "main",
    outboundLegs: [],
    returnLegs: [],
    intercityLegs: [
      {
        id: "leg-a",
        transportType: "train",
        fromCity: "Tottori",
        toCity: "Hiroshima",
        travelDate: "2026-12-13",
        originGroupId: "g-amanda",
      },
      {
        id: "leg-b",
        transportType: "train",
        fromCity: "Tottori",
        toCity: "Hiroshima",
        travelDate: "2026-12-13",
        originGroupId: "g-kaleb",
      },
    ],
  } as TripEntityGraph;

  it("shares route siblings across personal legs", () => {
    assert.deepEqual(transportLegIdsSharingRoute(graph, "leg-a").sort(), ["leg-a", "leg-b"]);
    assert.equal(
      personalTransportRouteFinanceKey(graph, "leg-a"),
      personalTransportRouteFinanceKey(graph, "leg-b"),
    );
  });

  it("uses one finance bucket per personal route", () => {
    const keyA = financeLinkBucketKey(line({ linkedTransportLegId: "leg-a" }), graph);
    const keyB = financeLinkBucketKey(line({ linkedTransportLegId: "leg-b" }), graph);
    assert.equal(keyA, keyB);
    assert.match(keyA ?? "", /^transport_route:/);
  });

  it("blocks seeding when a sibling route row already exists", () => {
    const existing = [line({ id: "line-a", linkedTransportLegId: "leg-a" })];
    const seeds = [
      {
        sortOrder: 1,
        category: "transport" as const,
        description: "JR Pass",
        notes: null,
        totalAmountCents: 0,
        currency: "NZD",
        quantity: null,
        allocationRuleType: "equal_present" as const,
        allocationRulePayload: {},
        linkedStayId: null,
        linkedTransportLegId: "leg-b",
        linkedTransportProductId: null,
        linkedActivityId: null,
        scope: "presence" as const,
        supplierPaymentStatus: null,
        costStatus: "estimated" as const,
        linePaymentStatus: "unpaid" as const,
        fundingStatus: "unfunded" as const,
        supplierName: null,
        estimatedAmountCents: null,
        actualAmountCents: null,
        taxTreatment: null,
        exportCategoryLabel: null,
        exportReference: null,
        bookingReference: null,
        invoiceRecorded: false,
        receiptRecorded: false,
      },
    ];

    assert.equal(transportRouteAlreadySeededInLedger(existing, graph, "leg-b"), true);
    assert.deepEqual(seedItemsNotYetPresent(existing, seeds, new Set(), graph), []);
  });
});
