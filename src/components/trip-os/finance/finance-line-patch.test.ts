import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { patchBulkParticipantAllocations, patchLinePayload, patchParticipantAllocation } from "./finance-line-patch";
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

  it("sets row total to the sum of pinned amounts", () => {
    const patch = patchBulkParticipantAllocations(
      line(0),
      lineAlloc({ allocations: { p1: 0, p2: 0, p3: 0 } }),
      [
        { participantId: "p1", amountCents: 209_500 },
        { participantId: "p2", amountCents: 209_500 },
      ],
    );
    assert.equal(patch.totalAmountCents, 419_000);
    assert.deepEqual(patch.overrides, [
      { participantId: "p1", amountCents: 209_500 },
      { participantId: "p2", amountCents: 209_500 },
    ]);
  });

  it("replaces existing pins when applying a bulk modal split", () => {
    const patch = patchBulkParticipantAllocations(
      line(0),
      lineAlloc({
        allocations: { p1: 50_00, p2: 50_00, p3: 0 },
        pinnedParticipantIds: ["p1", "p2"],
      }),
      [{ participantId: "p3", amountCents: 110_00 }],
      { replacePins: true },
    );
    assert.equal(patch.totalAmountCents, 110_00);
    assert.deepEqual(patch.overrides, [{ participantId: "p3", amountCents: 110_00 }]);
  });
});

describe("patchLinePayload", () => {
  it("clears pinned overrides when row total is set to zero", () => {
    const patch = patchLinePayload(line(100000), { totalAmountCents: 0 });
    assert.equal(patch.totalAmountCents, 0);
    assert.deepEqual(patch.overrides, []);
    assert.equal(patch.allocationRulePayload, undefined);
  });

  it("does not send allocationRulePayload when only renaming a manual line", () => {
    const manualLine: CostLineItemDraft = {
      ...line(0),
      linkedStayId: null,
      category: "other",
      allocationRulePayload: { financeSection: "transport" },
    };
    const patch = patchLinePayload(manualLine, { description: "Travel insurance" });
    assert.equal(patch.description, "Travel insurance");
    assert.equal(patch.allocationRulePayload, undefined);
  });

  it("preserves financeSection when allocation rule changes", () => {
    const manualLine: CostLineItemDraft = {
      ...line(0),
      linkedStayId: null,
      category: "other",
      allocationRuleType: "equal_cost_participants",
      allocationRulePayload: { financeSection: "transport" },
    };
    const patch = patchLinePayload(manualLine, { allocationRuleType: "manual" });
    assert.deepEqual(patch.allocationRulePayload, { financeSection: "transport" });
  });
});
