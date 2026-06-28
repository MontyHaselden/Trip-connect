import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  activityFinanceContentKey,
  visibleActivityFinanceLineIds,
} from "./activity-finance-dedupe";
import { seedItemsNotYetPresent } from "./seed-from-graph";
import type { CostLineItemDraft } from "./types";

function activityLine(partial: Partial<CostLineItemDraft>): CostLineItemDraft {
  return {
    id: "line-1",
    description: "Team labs",
    category: "activities",
    notes: "2026-12-19",
    quantity: 1,
    totalAmountCents: 0,
    currency: "NZD",
    allocationRuleType: "equal_present",
    allocationRulePayload: {},
    linkedStayId: null,
    linkedTransportLegId: null,
    linkedActivityId: "act-1",
    linkedTransportProductId: null,
    scope: "whole_group",
    sortOrder: 0,
    supplierPaymentStatus: "unpaid",
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

describe("activity finance dedupe", () => {
  it("builds a stable content key from title and date", () => {
    assert.equal(
      activityFinanceContentKey({
        category: "activities",
        description: "Tokyo tower",
        notes: "2026-12-19 · whole group",
      }),
      "2026-12-19|tokyo tower",
    );
  });

  it("keeps one visible line per linked activity id", () => {
    const visible = visibleActivityFinanceLineIds([
      activityLine({ id: "line-a", totalAmountCents: 0 }),
      activityLine({ id: "line-b", totalAmountCents: 38000 }),
    ]);
    assert.equal(visible.size, 1);
    assert.ok(visible.has("line-b"));
  });

  it("skips seeding when an activity content key already exists", () => {
    const existing = [
      activityLine({
        id: "line-existing",
        linkedActivityId: "act-old",
        description: "Kimono dress up",
        notes: "2026-12-17",
      }),
    ];
    const seeds = [
      {
        sortOrder: 1,
        category: "activities" as const,
        description: "Kimono dress up",
        notes: "2026-12-17",
        totalAmountCents: 0,
        currency: "NZD",
        quantity: null,
        allocationRuleType: "equal_present" as const,
        allocationRulePayload: {},
        linkedStayId: null,
        linkedTransportLegId: null,
        linkedTransportProductId: null,
        linkedActivityId: "act-new",
        scope: "whole_group" as const,
        supplierPaymentStatus: "unpaid" as const,
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

    assert.deepEqual(seedItemsNotYetPresent(existing, seeds), []);
  });
});
