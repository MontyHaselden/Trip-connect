import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isServerFinanceLineId,
  planFinanceLineDeletes,
} from "./finance-line-delete-plan";
import type { CostLedgerProjection } from "./types";

function ledgerWithOptimisticStay(stayId: string): CostLedgerProjection {
  return {
    settings: {
      baseCurrency: "NZD",
      foreignCurrency: null,
      exchangeRate: null,
      exchangeRateDate: null,
      exchangeRateManual: false,
      financeCustomSections: [],
      financeViewGroups: [],
      financeSectionExclusions: {},
    },
    lineItems: [
      {
        id: `optimistic-stay-${stayId}`,
        sortOrder: 0,
        category: "accommodation",
        description: "The Knot",
        notes: null,
        totalAmountCents: 0,
        currency: "NZD",
        quantity: 2,
        allocationRuleType: "equal_present",
        allocationRulePayload: {},
        linkedStayId: stayId,
        linkedTransportLegId: null,
        linkedTransportProductId: null,
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
      },
    ],
    lineAllocations: [],
    funds: [],
    fundAllocations: {},
    payments: [],
    supplierPayments: [],
    personBalances: [],
    categoryTotals: {
      flights: 0,
      transport: 0,
      insurance: 0,
      accommodation: 0,
      meals: 0,
      activities: 0,
      other: 0,
    },
    tripGrossCents: 0,
    tripFundCreditsCents: 0,
    tripPaidCents: 0,
    tripOutstandingCents: 0,
  };
}

describe("finance-line-delete-plan", () => {
  const stayId = "81f96f12-4b9c-42f2-a32a-443d6ee388c1";

  it("detects server finance line ids", () => {
    assert.equal(isServerFinanceLineId(stayId), true);
    assert.equal(isServerFinanceLineId(`optimistic-stay-${stayId}`), false);
  });

  it("routes optimistic accommodation rows to trip removal instead of server delete", () => {
    const plan = planFinanceLineDeletes(
      [`optimistic-stay-${stayId}`],
      "removeFromTrip",
      ledgerWithOptimisticStay(stayId),
      new Map(),
    );
    assert.deepEqual(plan.serverLineIds, []);
    assert.equal(plan.removeFromTripLines.length, 1);
    assert.equal(plan.removeFromTripLines[0]?.linkedStayId, stayId);
  });

  it("routes optimistic accommodation rows to finance dismissal when finance-only", () => {
    const plan = planFinanceLineDeletes(
      [`optimistic-stay-${stayId}`],
      "financeOnly",
      ledgerWithOptimisticStay(stayId),
      new Map(),
    );
    assert.deepEqual(plan.serverLineIds, []);
    assert.deepEqual(plan.dismissKeys, [
      { entityType: "accommodation_stay", entityId: stayId },
    ]);
  });
});
