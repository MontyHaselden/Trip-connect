import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  fundBelongsToFinanceSection,
  fundsForFinanceSection,
  fundsForOverallView,
  hasEmptyFundForSection,
  primaryMiscFinanceSection,
} from "./finance-fund-sections";
import type { TripFundDraft } from "./types";

const fund = (section?: string, amount = 0): TripFundDraft => ({
  id: crypto.randomUUID(),
  name: "Test",
  amountCents: amount,
  currency: "NZD",
  allocationRuleType: "equal_cost_participants",
  allocationRulePayload: section ? { financeSection: section } : {},
  sortOrder: 0,
  notes: null,
});

describe("finance-fund-sections", () => {
  it("filters funds to a finance tab", () => {
    const funds = [fund("accommodation", 100), fund("transport", 200), fund()];
    assert.equal(fundsForFinanceSection(funds, "accommodation").length, 1);
    assert.equal(fundsForFinanceSection(funds, null).length, 3);
  });

  it("routes orphan funds to the permanent Other section", () => {
    const funds = [fund("accommodation", 100), fund(undefined, 168_132), fund(undefined, 89_458)];
    assert.equal(primaryMiscFinanceSection(), "other");
    assert.equal(fundsForFinanceSection(funds, "other").length, 2);
    assert.equal(fundsForFinanceSection(funds, "accommodation").length, 1);
    assert.equal(fundBelongsToFinanceSection(funds[1]!, "other"), true);
  });

  it("detects empty placeholder per section", () => {
    const funds = [fund("accommodation", 0), fund("transport", 0)];
    assert.equal(hasEmptyFundForSection(funds, "accommodation"), true);
    assert.equal(hasEmptyFundForSection(funds, "activities"), false);
  });

  it("overall view excludes all payment detail rows", () => {
    const funds = [
      fund("accommodation", 0),
      fund("transport", 500),
      fund(undefined, 1000),
    ];
    assert.equal(fundsForOverallView(funds).length, 0);
  });
});
