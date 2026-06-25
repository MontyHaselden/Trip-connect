import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { applyDeleteFinanceCustomSection } from "./delete-finance-custom-section";
import { emptyCostLedgerProjection } from "./empty-projection";
import { FINANCE_OTHER_SECTION } from "./finance-sections";
import type { CostLedgerRaw } from "./types";

function rawLedger(partial?: Partial<CostLedgerRaw>): CostLedgerRaw {
  const base = emptyCostLedgerProjection();
  return {
    settings: base.settings,
    lineItems: [],
    overrides: [],
    funds: [],
    payments: [],
    supplierPayments: [],
    ...partial,
  };
}

describe("delete finance custom section", () => {
  it("moves manual rows to Other and removes the custom tab", () => {
    const customId = "section-gifts";
    const raw = rawLedger({
      settings: {
        ...emptyCostLedgerProjection().settings,
        financeCustomSections: [
          { id: customId, name: "Gifts", description: null },
        ],
        financeSectionExclusions: {
          [customId]: ["participant-1"],
        },
      },
      lineItems: [
        {
          id: "line-1",
          sortOrder: 0,
          category: "other",
          description: "Souvenirs",
          notes: null,
          totalAmountCents: 5000,
          currency: "NZD",
          quantity: null,
          allocationRuleType: "equal_cost_participants",
          allocationRulePayload: { financeSection: customId },
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
        },
      ],
      funds: [
        {
          id: "fund-1",
          name: "Gifts fund",
          amountCents: 0,
          currency: "NZD",
          allocationRuleType: "equal_cost_participants",
          allocationRulePayload: { financeSection: customId },
          notes: null,
        },
      ],
    });

    const next = applyDeleteFinanceCustomSection(raw, customId);
    assert.ok(next);
    assert.equal(next.settings.financeCustomSections.length, 0);
    assert.equal(next.settings.financeSectionExclusions[customId], undefined);
    assert.equal(
      next.lineItems[0]!.allocationRulePayload.financeSection,
      FINANCE_OTHER_SECTION,
    );
    assert.equal(
      next.funds[0]!.allocationRulePayload.financeSection,
      FINANCE_OTHER_SECTION,
    );
  });

  it("refuses built-in sections", () => {
    const raw = rawLedger();
    assert.equal(applyDeleteFinanceCustomSection(raw, "accommodation"), null);
  });
});
