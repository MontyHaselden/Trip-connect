import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  effectiveLineTotalCents,
  sectionLinesSubtotalCents,
  supplierPaidCentsForLines,
  supplierPaidCentsForParticipantOnLines,
} from "./finance-grid-totals";
import type { CostLedgerProjection, CostLineItemDraft } from "./types";

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
  category: "transport",
  description: "Flight",
  notes: null,
  totalAmountCents: 100_00,
  currency: "NZD",
  quantity: null,
  allocationRuleType: "equal_cost_participants",
  allocationRulePayload: {},
  linkedStayId: null,
  linkedTransportLegId: null,
  linkedActivityId: null,
  scope: "trip_wide",
  supplierPaymentStatus: null,
  costStatus: "confirmed",
  linePaymentStatus: "unpaid",
  fundingStatus: "unfunded",
  supplierName: null,
  estimatedAmountCents: null,
  actualAmountCents: null,
  taxTreatment: "no_gst",
  exportCategoryLabel: null,
  exportReference: null,
  bookingReference: null,
  invoiceRecorded: false,
  receiptRecorded: false,
};

function ledger(overrides: Partial<CostLedgerProjection> = {}): CostLedgerProjection {
  return {
    settings,
    lineItems: [line],
    lineAllocations: [
      {
        lineItemId: "line-1",
        allocations: { p1: 50_00, p2: 50_00 },
        eligibleParticipantIds: ["p1", "p2"],
        pinnedParticipantIds: [],
        balanced: true,
        allocatedTotalCents: 100_00,
      },
    ],
    funds: [],
    fundAllocations: {},
    payments: [],
    supplierPayments: [
      {
        id: "pay-1",
        costLineItemId: "line-1",
        paidAt: "2026-01-01",
        paidByType: "school_bank",
        paidByName: null,
        paidTo: "Airline",
        amountCents: 40_00,
        currency: "NZD",
        paymentMethod: "bank_transfer",
        reference: null,
        receiptStatus: null,
        reimbursementNeeded: false,
        notes: null,
      },
    ],
    personBalances: [],
    categoryTotals: {} as CostLedgerProjection["categoryTotals"],
    tripGrossCents: 100_00,
    tripFundCreditsCents: 0,
    tripPaidCents: 0,
    tripOutstandingCents: 100_00,
    ...overrides,
  };
}

describe("finance-grid-totals", () => {
  it("uses allocated cents for display when stored total is still zero", () => {
    assert.equal(
      effectiveLineTotalCents(
        { totalAmountCents: 0 },
        {
          allocatedTotalCents: 220_00,
          pinnedParticipantIds: ["p1", "p2"],
        },
      ),
      220_00,
    );
  });

  it("does not inflate stored row total from pending per-person edits", () => {
    assert.equal(
      effectiveLineTotalCents(
        { totalAmountCents: 436_800 },
        { allocatedTotalCents: 436_800, pinnedParticipantIds: [] },
        { p1: 229_90, p2: 229_90 },
      ),
      436_800,
    );
  });

  it("includes pending per-person edits in section subtotals", () => {
    const lines = [{ ...line, totalAmountCents: 0 }];
    const subtotal = sectionLinesSubtotalCents(
      lines,
      [
        {
          lineItemId: "line-1",
          allocations: { p1: 110_00, p2: 110_00 },
          eligibleParticipantIds: ["p1", "p2"],
          pinnedParticipantIds: ["p1", "p2"],
          balanced: true,
          allocatedTotalCents: 220_00,
        },
      ],
      settings,
      {
        "line-1": { p1: 110_00, p2: 110_00 },
      },
    );
    assert.equal(subtotal, 220_00);
  });

  it("sums supplier payments linked to section lines", () => {
    assert.equal(supplierPaidCentsForLines([line], ledger()), 40_00);
  });

  it("splits paid amount by participant allocation share", () => {
    const allocationByLine = new Map([["line-1", { p1: 50_00, p2: 50_00 }]]);
    assert.equal(
      supplierPaidCentsForParticipantOnLines([line], "p1", ledger(), allocationByLine),
      20_00,
    );
  });
});
