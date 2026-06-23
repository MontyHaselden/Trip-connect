import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { applyOptimisticFinancePatch } from "./optimistic-finance-patch";
import type { CostLedgerProjection } from "./types";

const roster = {
  participants: [
    {
      id: "p1",
      fullName: "Amanda",
      role: "student" as const,
      inCostSplit: true,
      groupIds: ["main"],
    },
    {
      id: "p2",
      fullName: "Amber",
      role: "student" as const,
      inCostSplit: true,
      groupIds: ["main"],
    },
  ],
  groups: [],
  rooms: [],
};

function ledger(): CostLedgerProjection {
  return {
    settings: {
      baseCurrency: "NZD",
      foreignCurrency: null,
      exchangeRate: null,
      exchangeRateDate: null,
      exchangeRateManual: false,
    },
    lineItems: [
      {
        id: "line-1",
        sortOrder: 0,
        category: "accommodation",
        description: "Hotel",
        notes: null,
        totalAmountCents: 20000,
        currency: "NZD",
        quantity: null,
        allocationRuleType: "equal_cost_participants",
        allocationRulePayload: {},
        linkedStayId: null,
        linkedTransportLegId: null,
        linkedActivityId: null,
        scope: "trip_wide",
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
    lineAllocations: [
      {
        lineItemId: "line-1",
        allocations: { p1: 10000, p2: 10000 },
        eligibleParticipantIds: ["p1", "p2"],
        pinnedParticipantIds: [],
        balanced: true,
        allocatedTotalCents: 20000,
      },
    ],
    funds: [],
    fundAllocations: {},
    payments: [],
    supplierPayments: [],
    personBalances: [],
    categoryTotals: {
      flights: 0,
      transport: 0,
      insurance: 0,
      accommodation: 20000,
      meals: 0,
      activities: 0,
      other: 0,
    },
    tripGrossCents: 20000,
    tripFundCreditsCents: 0,
    tripPaidCents: 0,
    tripOutstandingCents: 20000,
  };
}

describe("applyOptimisticFinancePatch", () => {
  it("updates row total immediately", () => {
    const next = applyOptimisticFinancePatch(ledger(), roster, null, {
      action: "updateLine",
      lineId: "line-1",
      line: { totalAmountCents: 380000 },
    });
    assert.ok(next);
    assert.equal(next.lineItems[0]?.totalAmountCents, 380000);
    assert.equal(next.tripGrossCents, 380000);
  });

  it("rebalances participant pins when one cell is edited", () => {
    const next = applyOptimisticFinancePatch(ledger(), roster, null, {
      action: "updateLine",
      lineId: "line-1",
      line: {
        overrides: [{ participantId: "p1", amountCents: 5000 }],
      },
    });
    assert.ok(next);
    const alloc = next.lineAllocations.find((row) => row.lineItemId === "line-1");
    assert.equal(alloc?.allocations.p1, 5000);
    assert.equal(alloc?.allocations.p2, 15000);
    assert.deepEqual(alloc?.pinnedParticipantIds, ["p1"]);
  });

  it("removes deleted rows immediately", () => {
    const next = applyOptimisticFinancePatch(ledger(), roster, null, {
      action: "deleteLines",
      lineIds: ["line-1"],
      mode: "financeOnly",
    });
    assert.ok(next);
    assert.equal(next.lineItems.length, 0);
    assert.equal(next.tripGrossCents, 0);
  });
});
