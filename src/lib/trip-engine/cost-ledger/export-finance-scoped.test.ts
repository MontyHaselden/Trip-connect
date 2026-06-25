import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildFinanceSpreadsheetCsv } from "./export-finance-scoped";
import type { CostLedgerProjection, CostLineItemDraft } from "./types";
import type { RosterSummary } from "../types";

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
  description: "Christchurch → Tokyo",
  notes: null,
  totalAmountCents: 2_066_323,
  currency: "NZD",
  quantity: null,
  allocationRuleType: "equal_cost_participants",
  allocationRulePayload: { financeSection: "transport" },
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

const roster: RosterSummary = {
  participants: [
    {
      id: "monty",
      fullName: "Monty",
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

function ledger(): CostLedgerProjection {
  return {
    settings,
    lineItems: [line],
    lineAllocations: [
      {
        lineItemId: "line-1",
        allocations: { monty: 104_318 },
        eligibleParticipantIds: ["monty"],
        pinnedParticipantIds: [],
        balanced: true,
        allocatedTotalCents: 104_318,
      },
    ],
    funds: [],
    fundAllocations: {},
    payments: [],
    supplierPayments: [],
    personBalances: [],
    categoryTotals: {} as CostLedgerProjection["categoryTotals"],
    tripGrossCents: 104_318,
    tripFundCreditsCents: 0,
    tripPaidCents: 0,
    tripOutstandingCents: 104_318,
  };
}

describe("buildFinanceSpreadsheetCsv personal section", () => {
  it("exports only participant share without qty or line total", () => {
    const csv = buildFinanceSpreadsheetCsv(
      { scope: "transport", participantId: "monty", format: "csv" },
      { ledger: ledger(), roster, tripName: "Japan 2026" },
    );

    assert.match(csv, /Participant,Monty/);
    assert.match(csv, /Description,Your cost/);
    assert.match(csv, /Christchurch → Tokyo,"1,043.18"/);
    assert.match(csv, /Total,"1,043.18"/);
    assert.match(csv, /Total to be paid,"1,043.18"/);
    assert.doesNotMatch(csv, /Line total/);
    assert.doesNotMatch(csv, /Qty/);
    assert.doesNotMatch(csv, /20,663/);
  });
});
