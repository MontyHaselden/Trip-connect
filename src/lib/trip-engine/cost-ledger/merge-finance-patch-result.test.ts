import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { emptyCostLedgerProjection } from "./empty-projection";
import { mergeFinancePatchResult } from "./merge-finance-patch-result";

describe("mergeFinancePatchResult", () => {
  it("uses saved server rows and allocations for existing line ids", () => {
    const optimistic = emptyCostLedgerProjection();
    optimistic.lineItems = [
      {
        ...optimistic.lineItems[0]!,
        id: "line-1",
        description: "Meals",
        totalAmountCents: 115_000,
        costStatus: "no_cost",
      },
    ];
    optimistic.lineAllocations = [
      {
        lineItemId: "line-1",
        allocations: { p1: 57_500, p2: 57_500 },
        eligibleParticipantIds: ["p1", "p2"],
        pinnedParticipantIds: [],
        balanced: true,
        allocatedTotalCents: 115_000,
      },
    ];

    const server = emptyCostLedgerProjection();
    server.lineItems = [
      {
        ...server.lineItems[0]!,
        id: "line-1",
        description: "Meals",
        totalAmountCents: 0,
        costStatus: "no_cost",
      },
    ];
    server.lineAllocations = [
      {
        lineItemId: "line-1",
        allocations: {},
        eligibleParticipantIds: ["p1", "p2"],
        pinnedParticipantIds: [],
        balanced: true,
        allocatedTotalCents: 0,
      },
    ];

    const merged = mergeFinancePatchResult(optimistic, server);
    assert.equal(merged.lineItems[0]?.totalAmountCents, 0);
    assert.equal(merged.lineItems[0]?.costStatus, "no_cost");
    assert.equal(merged.lineAllocations[0]?.allocatedTotalCents, 0);
  });

  it("keeps optimistic-only rows that are not on the server yet", () => {
    const optimistic = emptyCostLedgerProjection();
    optimistic.lineItems = [
      {
        ...optimistic.lineItems[0]!,
        id: "optimistic-1",
        description: "New line",
        totalAmountCents: 5000,
      },
    ];

    const merged = mergeFinancePatchResult(optimistic, emptyCostLedgerProjection());
    assert.equal(merged.lineItems.length, 1);
    assert.equal(merged.lineItems[0]?.totalAmountCents, 5000);
  });
});
