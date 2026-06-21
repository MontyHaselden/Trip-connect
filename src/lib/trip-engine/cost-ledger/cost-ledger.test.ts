import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { computeItemAllocations, splitAmountEvenly } from "./allocate";
import { projectCostLedger } from "./project";
import type { CostLedgerRaw } from "./types";

const roster = {
  participants: [
    { id: "s1", fullName: "Chris", role: "student", inCostSplit: true, groupIds: ["g1"], roomId: null },
    { id: "s2", fullName: "Alex", role: "student", inCostSplit: true, groupIds: ["g1"], roomId: null },
    { id: "s3", fullName: "Amanda", role: "teacher", inCostSplit: true, groupIds: ["g2"], roomId: null },
    { id: "h1", fullName: "Host", role: "host", inCostSplit: false, groupIds: [], roomId: null },
  ],
  groups: [
    { id: "g1", name: "Kagoshima" },
    { id: "g2", name: "Tottori" },
  ],
  rooms: [],
};

describe("splitAmountEvenly", () => {
  it("distributes remainder cents to first participants", () => {
    const out = splitAmountEvenly(100, ["a", "b", "c"]);
    assert.equal(out.a + out.b + out.c, 100);
    assert.deepEqual(out, { a: 34, b: 33, c: 33 });
  });
});

describe("computeItemAllocations", () => {
  it("splits equally among cost participants", () => {
    const { allocations, balanced } = computeItemAllocations(
      {
        id: "line1",
        totalAmountCents: 12000,
        currency: "NZD",
        allocationRuleType: "equal_cost_participants",
        allocationRulePayload: {},
      },
      roster,
      [],
    );
    assert.equal(balanced, true);
    assert.equal(allocations.s1, 4000);
    assert.equal(allocations.s2, 4000);
    assert.equal(allocations.s3, 4000);
    assert.equal(allocations.h1, undefined);
  });

  it("assigns to one participant", () => {
    const { allocations, balanced } = computeItemAllocations(
      {
        id: "line2",
        totalAmountCents: 50000,
        currency: "NZD",
        allocationRuleType: "assign_one",
        allocationRulePayload: { participantId: "s3" },
      },
      roster,
      [],
    );
    assert.equal(balanced, true);
    assert.equal(allocations.s3, 50000);
  });
});

describe("projectCostLedger", () => {
  it("computes balances with funds and payments", () => {
    const raw: CostLedgerRaw = {
      settings: {
        baseCurrency: "NZD",
        foreignCurrency: null,
        exchangeRate: null,
        exchangeRateDate: null,
        exchangeRateManual: false,
      },
      lineItems: [
        {
          id: "l1",
          sortOrder: 0,
          category: "accommodation",
          description: "Hotel",
          notes: null,
          totalAmountCents: 120000,
          currency: "NZD",
          quantity: null,
          allocationRuleType: "equal_cost_participants",
          allocationRulePayload: {},
          linkedStayId: null,
          linkedTransportLegId: null,
          linkedActivityId: null,
          supplierPaymentStatus: null,
        },
      ],
      overrides: [],
      funds: [
        {
          id: "f1",
          name: "Council grant",
          amountCents: 15000,
          currency: "NZD",
          allocationRuleType: "equal_cost_participants",
          allocationRulePayload: {},
          sortOrder: 0,
          notes: null,
        },
      ],
      payments: [
        {
          id: "p1",
          participantId: "s1",
          amountCents: 33000,
          currency: "NZD",
          paidAt: "2026-01-01",
          label: "deposit",
          notes: null,
        },
      ],
    };

    const projection = projectCostLedger(raw, roster);
    const chris = projection.personBalances.find((p) => p.participantId === "s1");
    assert.ok(chris);
    assert.equal(chris.grossCents, 40000);
    assert.equal(chris.fundCreditsCents, 5000);
    assert.equal(chris.paidCents, 33000);
    assert.equal(chris.balanceCents, 2000);
  });
});
