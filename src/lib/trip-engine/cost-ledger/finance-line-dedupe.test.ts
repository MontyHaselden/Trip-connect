import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  activityFinanceContentKey,
  canonicalFinanceLineIds,
  financeLineContentKey,
  financeLineIdsToDrop,
  financeLinePrimaryLinkKey,
} from "./finance-line-dedupe";
import { dedupeFinanceSeeds } from "./dedupe-finance-seeds";
import { seedItemsNotYetPresent } from "./seed-from-graph";
import type { CostLineItemDraft } from "./types";

function line(partial: Partial<CostLineItemDraft>): CostLineItemDraft {
  return {
    id: "line-1",
    description: "Test",
    category: "accommodation",
    notes: null,
    quantity: 1,
    totalAmountCents: 0,
    currency: "NZD",
    allocationRuleType: "equal_present",
    allocationRulePayload: {},
    linkedStayId: null,
    linkedTransportLegId: null,
    linkedTransportProductId: null,
    linkedActivityId: null,
    scope: "presence",
    sortOrder: 0,
    supplierPaymentStatus: null,
    costStatus: "estimated",
    linePaymentStatus: "unpaid",
    fundingStatus: "unfunded",
    supplierName: null,
    estimatedAmountCents: null,
    actualAmountCents: null,
    taxTreatment: null,
    exportCategoryLabel: null,
    exportReference: null,
    bookingReference: null,
    invoiceRecorded: false,
    receiptRecorded: false,
    ...partial,
  };
}

describe("finance line dedupe", () => {
  it("builds primary link keys for all linked entity types", () => {
    assert.equal(financeLinePrimaryLinkKey(line({ linkedStayId: "stay-1" })), "stay:stay-1");
    assert.equal(
      financeLinePrimaryLinkKey(line({ linkedTransportLegId: "leg-1" })),
      "transport:leg-1",
    );
    assert.equal(
      financeLinePrimaryLinkKey(line({ linkedTransportProductId: "prod-1" })),
      "transport_product:prod-1",
    );
    assert.equal(
      financeLinePrimaryLinkKey(line({ linkedActivityId: "act-1" })),
      "activity:act-1",
    );
  });

  it("keeps one canonical row per linked stay id", () => {
    const priced = line({
      id: "line-priced",
      category: "accommodation",
      linkedStayId: "stay-1",
      totalAmountCents: 120000,
      description: "Hotel New Hankyu (Kyoto)",
      notes: "2026-12-18 → 2026-12-21",
    });
    const empty = line({
      id: "line-empty",
      category: "accommodation",
      linkedStayId: "stay-1",
      totalAmountCents: 0,
      description: "Hotel New Hankyu (Kyoto)",
      notes: "2026-12-18 → 2026-12-21",
    });

    const canonical = canonicalFinanceLineIds([empty, priced]);
    assert.equal(canonical.size, 1);
    assert.ok(canonical.has("line-priced"));
    assert.equal(financeLineIdsToDrop([empty, priced]).has("line-empty"), true);
  });

  it("keeps one canonical row per linked transport leg id", () => {
    const priced = line({
      id: "line-priced",
      category: "transport",
      linkedTransportLegId: "leg-1",
      totalAmountCents: 50000,
      description: "Flight Tokyo → Tottori",
    });
    const empty = line({
      id: "line-empty",
      category: "transport",
      linkedTransportLegId: "leg-1",
      totalAmountCents: 0,
      description: "Flight Tokyo → Tottori",
    });

    const canonical = canonicalFinanceLineIds([empty, priced]);
    assert.ok(canonical.has("line-priced"));
    assert.equal(financeLineIdsToDrop([empty, priced]).has("line-empty"), true);
  });

  it("collapses orphan transport rows with the same description", () => {
    const first = line({
      id: "line-1",
      category: "transport",
      description: "JR Pass",
      totalAmountCents: 0,
    });
    const second = line({
      id: "line-2",
      category: "transport",
      description: "JR Pass",
      totalAmountCents: 45000,
    });

    const canonical = canonicalFinanceLineIds([first, second]);
    assert.ok(canonical.has("line-2"));
    assert.equal(financeLineIdsToDrop([first, second]).has("line-1"), true);
  });

  it("skips seeding accommodation and transport content duplicates", () => {
    const existing = [
      line({
        id: "line-stay",
        category: "accommodation",
        linkedStayId: "stay-old",
        description: "Hotel New Hankyu (Kyoto)",
        notes: "2026-12-18 → 2026-12-21",
      }),
    ];
    const staySeed = {
      sortOrder: 1,
      category: "accommodation" as const,
      description: "Hotel New Hankyu (Kyoto)",
      notes: "2026-12-18 → 2026-12-21",
      totalAmountCents: 0,
      currency: "NZD",
      quantity: 3,
      allocationRuleType: "equal_present" as const,
      allocationRulePayload: {},
      linkedStayId: "stay-new",
      linkedTransportLegId: null,
      linkedTransportProductId: null,
      linkedActivityId: null,
      scope: "presence" as const,
      supplierPaymentStatus: null,
      costStatus: "estimated" as const,
      linePaymentStatus: "unpaid" as const,
      fundingStatus: "unfunded" as const,
      supplierName: null,
      estimatedAmountCents: null,
      actualAmountCents: null,
      taxTreatment: null,
      exportCategoryLabel: null,
      exportReference: null,
      bookingReference: null,
      invoiceRecorded: false,
      receiptRecorded: false,
    };

    assert.deepEqual(seedItemsNotYetPresent(existing, [staySeed]), []);

    const transportSeed = {
      ...staySeed,
      category: "transport" as const,
      description: "JR Pass",
      notes: null,
      linkedStayId: null,
      linkedTransportProductId: "prod-new",
      quantity: null,
    };
    const existingTransport = [
      line({
        id: "line-jr",
        category: "transport",
        linkedTransportProductId: "prod-old",
        description: "JR Pass",
      }),
    ];
    assert.deepEqual(seedItemsNotYetPresent(existingTransport, [transportSeed]), []);
  });

  it("dedupes optimistic seed batches across entity types", () => {
    const existing: CostLineItemDraft[] = [];
    const seeds = [
      {
        sortOrder: 0,
        category: "activities" as const,
        description: "Team labs",
        notes: "2026-12-19",
        totalAmountCents: 0,
        currency: "NZD",
        quantity: null,
        allocationRuleType: "equal_present" as const,
        allocationRulePayload: {},
        linkedStayId: null,
        linkedTransportLegId: null,
        linkedTransportProductId: null,
        linkedActivityId: "act-1",
        scope: "presence" as const,
        supplierPaymentStatus: null,
        costStatus: "estimated" as const,
        linePaymentStatus: "unpaid" as const,
        fundingStatus: "unfunded" as const,
        supplierName: null,
        estimatedAmountCents: null,
        actualAmountCents: null,
        taxTreatment: null,
        exportCategoryLabel: null,
        exportReference: null,
        bookingReference: null,
        invoiceRecorded: false,
        receiptRecorded: false,
      },
      {
        sortOrder: 1,
        category: "activities" as const,
        description: "Team labs",
        notes: "2026-12-19",
        totalAmountCents: 0,
        currency: "NZD",
        quantity: null,
        allocationRuleType: "equal_present" as const,
        allocationRulePayload: {},
        linkedStayId: null,
        linkedTransportLegId: null,
        linkedTransportProductId: null,
        linkedActivityId: "act-1",
        scope: "presence" as const,
        supplierPaymentStatus: null,
        costStatus: "estimated" as const,
        linePaymentStatus: "unpaid" as const,
        fundingStatus: "unfunded" as const,
        supplierName: null,
        estimatedAmountCents: null,
        actualAmountCents: null,
        taxTreatment: null,
        exportCategoryLabel: null,
        exportReference: null,
        bookingReference: null,
        invoiceRecorded: false,
        receiptRecorded: false,
      },
    ];

    assert.equal(dedupeFinanceSeeds(existing, seeds).length, 1);
    assert.equal(
      activityFinanceContentKey({
        category: "activities",
        description: "Tokyo tower",
        notes: "2026-12-19 · whole group",
      }),
      "2026-12-19|tokyo tower",
    );
    assert.equal(
      financeLineContentKey(line({
        category: "accommodation",
        description: "Hotel Yamadano",
        notes: "2026-12-21 → 2026-12-24",
      })),
      "accommodation:2026-12-21 → 2026-12-24:hotel yamadano",
    );
  });
});
