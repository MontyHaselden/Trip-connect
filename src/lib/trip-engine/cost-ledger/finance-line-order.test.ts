import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  applySortOrderInsert,
  reorderFinanceSectionLines,
  sortOrderForSectionAppend,
} from "./finance-line-order";
import type { CostLineItemDraft } from "./types";

function line(
  id: string,
  sortOrder: number,
  section?: "accommodation" | "transport" | "activities",
): CostLineItemDraft {
  return {
    id,
    sortOrder,
    category: "other",
    description: id,
    notes: null,
    totalAmountCents: 0,
    currency: "NZD",
    quantity: null,
    allocationRuleType: "equal_cost_participants",
    allocationRulePayload: section ? { financeSection: section } : {},
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
  };
}

describe("reorderFinanceSectionLines", () => {
  it("reorders only lines in the target section", () => {
    const lines = [
      line("a1", 0, "accommodation"),
      line("t1", 1, "transport"),
      line("a2", 2, "accommodation"),
      line("a3", 3, "accommodation"),
    ];
    const next = reorderFinanceSectionLines(lines, "accommodation", ["a3", "a1", "a2"]);
    assert.deepEqual(
      next.map((row) => row.id),
      ["a3", "t1", "a1", "a2"],
    );
    assert.deepEqual(
      next.map((row) => row.sortOrder),
      [0, 1, 2, 3],
    );
  });
});

describe("sortOrderForSectionAppend", () => {
  it("returns index after the last line in the section", () => {
    const lines = [
      line("a1", 0, "accommodation"),
      line("t1", 1, "transport"),
      line("a2", 2, "accommodation"),
    ];
    assert.equal(sortOrderForSectionAppend(lines, "accommodation"), 3);
    assert.equal(sortOrderForSectionAppend(lines, "transport"), 2);
    assert.equal(sortOrderForSectionAppend(lines, "activities"), 3);
  });
});

describe("applySortOrderInsert", () => {
  it("bumps sort orders at and after the insert index", () => {
    const lines = [line("a", 0), line("b", 1), line("c", 2)];
    const next = applySortOrderInsert(lines, 1);
    assert.equal(next.find((row) => row.id === "a")?.sortOrder, 0);
    assert.equal(next.find((row) => row.id === "b")?.sortOrder, 2);
    assert.equal(next.find((row) => row.id === "c")?.sortOrder, 3);
  });
});
