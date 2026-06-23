import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  effectiveLineQuantity,
  perUnitCents,
  quantityUnitLabel,
  totalFromUnitCents,
} from "./line-quantity-rate";
import type { CostLineItemDraft } from "./types";

function line(partial: Partial<CostLineItemDraft> = {}): CostLineItemDraft {
  return {
    id: "line-1",
    description: "Fee",
    category: "other",
    quantity: null,
    totalAmountCents: 0,
    currency: "NZD",
    allocationRuleType: "equal_cost_participants",
    allocationRulePayload: { financeSection: "transport" },
    linkedStayId: null,
    linkedTransportLegId: null,
    linkedActivityId: null,
    scope: "trip_wide",
    notes: null,
    sortOrder: 0,
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
    ...partial,
  };
}

describe("line-quantity-rate", () => {
  it("uses manual qty on extra lines", () => {
    assert.equal(effectiveLineQuantity(line({ quantity: 19 })), 19);
    assert.equal(quantityUnitLabel(line({ quantity: 19 })), "each");
  });

  it("computes per-unit and total from rate", () => {
    assert.equal(perUnitCents(209_000, 19), 11_000);
    assert.equal(totalFromUnitCents(11_000, 19), 209_000);
  });
});
