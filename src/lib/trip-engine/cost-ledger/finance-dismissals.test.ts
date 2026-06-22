import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { seedItemsNotYetPresent } from "./seed-from-graph";

describe("seedItemsNotYetPresent dismissals", () => {
  it("skips dismissed entity seeds", () => {
    const seeds = [
      {
        sortOrder: 0,
        category: "activities" as const,
        description: "Museum",
        notes: "2026-12-10",
        totalAmountCents: 0,
        currency: "NZD",
        quantity: null,
        allocationRuleType: "equal_present" as const,
        allocationRulePayload: {},
        linkedStayId: null,
        linkedTransportLegId: null,
        linkedActivityId: "act-1",
        scope: "presence" as const,
        supplierPaymentStatus: null,
      },
    ];

    const kept = seedItemsNotYetPresent([], seeds, new Set(["itinerary_item:act-1"]));
    assert.equal(kept.length, 0);
  });
});
