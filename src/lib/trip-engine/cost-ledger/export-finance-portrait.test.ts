import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildFinancePortraitHtml } from "./export-finance-portrait";
import { emptyCostLedgerProjection } from "./empty-projection";
import type { RosterSummary } from "../types";

const roster: RosterSummary = {
  participants: [
    {
      id: "p1",
      fullName: "Amanda Smith",
      role: "student",
      inCostSplit: true,
      groupIds: [],
      roomId: null,
      phone: null,
      email: null,
    },
  ],
  groups: [],
  rooms: [],
};

describe("buildFinancePortraitHtml", () => {
  it("includes trip name and escapes HTML", () => {
    const ledger = emptyCostLedgerProjection("NZD");
    const html = buildFinancePortraitHtml({
      ledger,
      roster,
      tripName: 'Japan <script>2026',
    });
    assert.match(html, /Japan &lt;script&gt;2026/);
    assert.match(html, /Finance report/);
    assert.match(html, /Trip summary/);
    assert.doesNotMatch(html, /<script>2026/);
  });

  it("renders section blocks when lines exist", () => {
    const ledger = emptyCostLedgerProjection("NZD");
    ledger.lineItems.push({
      id: "line-1",
      description: "Flight AKL → CHC",
      category: "transport",
      supplierName: "Air NZ",
      currency: "NZD",
      totalAmountCents: 100_00,
      estimatedAmountCents: null,
      actualAmountCents: null,
      quantity: null,
      costStatus: "confirmed",
      linePaymentStatus: "unpaid",
      fundingStatus: "unfunded",
      taxTreatment: "inclusive",
      exportCategoryLabel: "",
      exportReference: "",
      bookingReference: "",
      invoiceRecorded: false,
      receiptRecorded: false,
      notes: "",
      linkedStayId: null,
      linkedTransportLegId: null,
      linkedActivityId: null,
      allocationRuleType: "equal_cost_participants",
      allocationRulePayload: { financeSection: "transport" },
      sortOrder: 0,
    });
    ledger.lineAllocations.push({
      lineItemId: "line-1",
      allocations: { p1: 100_00 },
    });

    const html = buildFinancePortraitHtml({
      ledger,
      roster,
      tripName: "Japan 2026",
    });

    assert.match(html, /Transport/);
    assert.match(html, /Flight AKL → CHC/);
    assert.match(html, /Amanda S\./);
  });
});
