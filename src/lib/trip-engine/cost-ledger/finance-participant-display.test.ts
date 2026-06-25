import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  lineIsVisibleInFinanceBreakdown,
  participantAllocationCentsWithPending,
} from "./finance-participant-display";
import type { CostLineItemDraft, LineAllocationResult } from "./types";

const settings = {
  baseCurrency: "NZD",
  foreignCurrency: null,
  exchangeRate: null,
  exchangeRateDate: null,
  exchangeRateManual: false,
  financeCustomSections: [],
  financeViewGroups: [],
  financeSectionExclusions: {},
};

const line: CostLineItemDraft = {
  id: "line-1",
  sortOrder: 0,
  category: "other",
  description: "Meals",
  notes: null,
  totalAmountCents: 0,
  currency: "NZD",
  quantity: null,
  allocationRuleType: "equal_cost_participants",
  allocationRulePayload: { financeSection: "other" },
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

const lineAlloc: LineAllocationResult = {
  lineItemId: "line-1",
  allocations: { p1: 50_00, p2: 50_00 },
  eligibleParticipantIds: ["p1", "p2"],
  pinnedParticipantIds: ["p1", "p2"],
  balanced: true,
  allocatedTotalCents: 100_00,
};

describe("finance-participant-display", () => {
  it("shows pinned lines before stored total is synced", () => {
    assert.equal(lineIsVisibleInFinanceBreakdown(line, lineAlloc), true);
  });

  it("uses pending per-person edits in breakdown amounts", () => {
    const allocationByLine = new Map<string, Record<string, number>>([
      ["line-1", { p1: 0, p2: 50_00 }],
    ]);
    const pending = { p1: 60_00 };
    assert.equal(
      participantAllocationCentsWithPending(
        line,
        "p1",
        allocationByLine,
        settings,
        pending,
      ),
      60_00,
    );
  });
});
