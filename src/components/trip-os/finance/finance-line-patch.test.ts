import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { patchLinePayload, patchParticipantAllocation } from "./finance-line-patch";
import type { CostLineItemDraft, LineAllocationResult } from "@/lib/trip-engine/cost-ledger/types";

function line(totalAmountCents: number): CostLineItemDraft {
  return {
    id: "line-1",
    description: "Hotel",
    category: "accommodation",
    quantity: null,
    totalAmountCents,
    currency: "NZD",
    allocationRuleType: "equal_present",
    allocationRulePayload: {},
    linkedStayId: "stay-1",
    linkedTransportLegId: null,
    linkedActivityId: null,
    scope: "presence",
    notes: null,
    sortOrder: 0,
  };
}

function lineAlloc(partial: Partial<LineAllocationResult>): LineAllocationResult {
  return {
    lineItemId: "line-1",
    allocations: {},
    eligibleParticipantIds: ["p1", "p2", "p3"],
    pinnedParticipantIds: [],
    balanced: true,
    allocatedTotalCents: 0,
    ...partial,
  };
}

describe("patchParticipantAllocation", () => {
  it("bumps row total when a pinned amount exceeds the current total", () => {
    const patch = patchParticipantAllocation(
      line(0),
      lineAlloc({ allocations: { p1: 0, p2: 0, p3: 0 } }),
      "p1",
      50000,
    );
    assert.equal(patch.totalAmountCents, 50000);
    assert.deepEqual(patch.overrides, [{ participantId: "p1", amountCents: 50000 }]);
  });

  it("clears a pin when amount is removed", () => {
    const patch = patchParticipantAllocation(
      line(100000),
      lineAlloc({
        allocations: { p1: 50000, p2: 25000, p3: 25000 },
        pinnedParticipantIds: ["p1"],
      }),
      "p1",
      null,
    );
    assert.equal(patch.totalAmountCents, undefined);
    assert.deepEqual(patch.overrides, []);
  });
});

describe("patchLinePayload", () => {
  it("clears pinned overrides when row total is set to zero", () => {
    const patch = patchLinePayload(line(100000), { totalAmountCents: 0 });
    assert.equal(patch.totalAmountCents, 0);
    assert.deepEqual(patch.overrides, []);
  });
});
