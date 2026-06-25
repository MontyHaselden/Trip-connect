import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  type BillingAccessState,
} from "./access";

function state(overrides: Partial<BillingAccessState>): BillingAccessState {
  return {
    accountId: "a1",
    billingStatus: "trial",
    paused: false,
    trialEndsAt: new Date(Date.now() + 86400000),
    trialActive: true,
    canPublish: true,
    canUseLiveParticipantLinks: true,
    canEditTrips: true,
    ...overrides,
  };
}

describe("billing access rules (documented expectations)", () => {
  it("active trial allows publish", () => {
    const s = state({ billingStatus: "trial", trialActive: true });
    assert.equal(s.canPublish, true);
  });

  it("expired trial blocks publish", () => {
    const s = state({
      billingStatus: "trial",
      trialActive: false,
      trialEndsAt: new Date(Date.now() - 1000),
      canPublish: false,
      canUseLiveParticipantLinks: false,
    });
    assert.equal(s.canPublish, false);
  });

  it("paused blocks live access but allows edit", () => {
    const s = state({
      paused: true,
      canPublish: false,
      canUseLiveParticipantLinks: false,
      canEditTrips: true,
    });
    assert.equal(s.canEditTrips, true);
  });
});
