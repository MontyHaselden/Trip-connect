import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { orderFinanceSectionLines } from "./finance-line-chronology";
import type { CostLineItemDraft } from "./types";

function transportLine(
  id: string,
  sortOrder: number,
  description: string,
  legId: string | null,
): CostLineItemDraft {
  return {
    id,
    sortOrder,
    description,
    category: "transport",
    notes: null,
    totalAmountCents: 0,
    currency: "NZD",
    quantity: null,
    allocationRuleType: "equal_present",
    allocationRulePayload: {},
    linkedStayId: null,
    linkedTransportLegId: legId,
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

describe("orderFinanceSectionLines", () => {
  it("sorts calendar-linked transport rows by date while keeping manual rows in place", () => {
    const lines = [
      transportLine("return", 0, "2026-12-21: Tokyo → Christchurch", "leg-return"),
      {
        ...transportLine("insurance", 1, "Travel insurance", null),
        allocationRulePayload: { financeSection: "transport" },
        category: "insurance" as const,
      },
      transportLine("intercity", 2, "2026-12-06: Tokyo → Kagoshima", "leg-intercity"),
    ];

    const ordered = orderFinanceSectionLines(lines);
    assert.deepEqual(
      ordered.map((line) => line.id),
      ["intercity", "insurance", "return"],
    );
  });

  it("keeps transport pass / package rows after dated leg rows", () => {
    const lines = [
      transportLine("return", 0, "2026-12-21: Tokyo → Christchurch", "leg-return"),
      {
        ...transportLine("jr-pass", 1, "JR Pass", null),
        linkedTransportProductId: "product-jr",
      },
      transportLine("outbound", 2, "2026-12-05: Christchurch → Tokyo", "leg-outbound"),
      transportLine("intercity", 3, "2026-12-06: Tokyo → Kagoshima", "leg-intercity"),
    ];

    const ordered = orderFinanceSectionLines(lines);
    assert.deepEqual(
      ordered.map((line) => line.id),
      ["outbound", "intercity", "return", "jr-pass"],
    );
  });
});
