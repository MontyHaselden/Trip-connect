import { asc, eq, inArray } from "drizzle-orm";

import { db } from "@/lib/db/client";
import {
  costAllocationOverrides,
  costLineItems,
  participantPayments,
  tripCostSettings,
  tripFunds,
  tripSupplierPayments,
} from "@/lib/db/schema";

import type {
  CostAllocationOverrideDraft,
  CostLedgerRaw,
  CostLineItemDraft,
  FinanceCustomSection,
  FinanceViewGroup,
  ParticipantPaymentDraft,
  SupplierPaymentDraft,
  TripCostSettingsDraft,
  TripFundDraft,
} from "./types";
import type { PaidByType, SupplierPaymentMethod } from "./finance-metadata";
import { parseFinanceSectionExclusions } from "./finance-section-exclusions";

function parseCustomSections(value: unknown): FinanceCustomSection[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((row): row is FinanceCustomSection => {
      if (!row || typeof row !== "object") return false;
      const r = row as Record<string, unknown>;
      return typeof r.id === "string" && typeof r.name === "string";
    })
    .map((row) => ({
      id: row.id,
      name: row.name,
      description: typeof row.description === "string" ? row.description : null,
    }));
}

function parseViewGroups(value: unknown): FinanceViewGroup[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((row): row is FinanceViewGroup => {
      if (!row || typeof row !== "object") return false;
      const r = row as Record<string, unknown>;
      return (
        typeof r.id === "string" &&
        typeof r.name === "string" &&
        Array.isArray(r.participantIds) &&
        r.participantIds.every((id) => typeof id === "string")
      );
    })
    .map((row) => ({
      id: row.id,
      name: row.name,
      participantIds: row.participantIds,
    }));
}

function mapSettings(row: typeof tripCostSettings.$inferSelect | undefined): TripCostSettingsDraft {
  return {
    baseCurrency: row?.baseCurrency ?? "NZD",
    foreignCurrency: row?.foreignCurrency ?? null,
    exchangeRate: row?.exchangeRate ? Number(row.exchangeRate) : null,
    exchangeRateDate: row?.exchangeRateDate ?? null,
    exchangeRateManual: row?.exchangeRateManual ?? false,
    financeCustomSections: parseCustomSections(row?.financeCustomSections),
    financeViewGroups: parseViewGroups(row?.financeViewGroups),
    financeSectionExclusions: parseFinanceSectionExclusions(row?.financeSectionExclusions),
  };
}

function mapLine(row: typeof costLineItems.$inferSelect): CostLineItemDraft {
  const payload = (row.allocationRulePayload ?? {}) as Record<string, string>;
  return {
    id: row.id,
    sortOrder: row.sortOrder,
    category: row.category,
    description: row.description,
    notes: row.notes,
    totalAmountCents: row.totalAmountCents,
    currency: row.currency,
    quantity: row.quantity ? Number(row.quantity) : null,
    allocationRuleType: row.allocationRuleType,
    allocationRulePayload: {
      groupId: payload.groupId,
      participantId: payload.participantId,
      financeSection: payload.financeSection as CostLineItemDraft["allocationRulePayload"]["financeSection"],
    },
    linkedStayId: row.linkedStayId,
    linkedTransportLegId: row.linkedTransportLegId,
    linkedTransportProductId: row.linkedTransportProductId,
    linkedActivityId: row.linkedActivityId,
    scope: row.scope ?? "presence",
    supplierPaymentStatus: row.supplierPaymentStatus,
    costStatus: row.costStatus ?? "unknown",
    linePaymentStatus: row.linePaymentStatus ?? "unpaid",
    fundingStatus: row.fundingStatus ?? "unfunded",
    supplierName: row.supplierName,
    estimatedAmountCents: row.estimatedAmountCents,
    actualAmountCents: row.actualAmountCents,
    taxTreatment: row.taxTreatment ?? "unknown",
    exportCategoryLabel: row.exportCategoryLabel,
    exportReference: row.exportReference,
    bookingReference: row.bookingReference,
    invoiceRecorded: row.invoiceRecorded ?? false,
    receiptRecorded: row.receiptRecorded ?? false,
  };
}

function mapFund(row: typeof tripFunds.$inferSelect): TripFundDraft {
  const payload = (row.allocationRulePayload ?? {}) as Record<string, unknown>;
  const pinnedRaw = payload.pinnedAllocations;
  const pinnedAllocations =
    pinnedRaw && typeof pinnedRaw === "object" && !Array.isArray(pinnedRaw)
      ? Object.fromEntries(
          Object.entries(pinnedRaw as Record<string, unknown>).filter(
            (entry): entry is [string, number] =>
              typeof entry[1] === "number" && entry[1] >= 0,
          ),
        )
      : undefined;
  return {
    id: row.id,
    name: row.name,
    amountCents: row.amountCents,
    currency: row.currency,
    allocationRuleType: row.allocationRuleType,
    allocationRulePayload: {
      groupId: typeof payload.groupId === "string" ? payload.groupId : undefined,
      participantId:
        typeof payload.participantId === "string" ? payload.participantId : undefined,
      financeSection: payload.financeSection as CostLineItemDraft["allocationRulePayload"]["financeSection"],
      pinnedAllocations,
    },
    sortOrder: row.sortOrder,
    notes: row.notes,
  };
}

function mapPayment(row: typeof participantPayments.$inferSelect): ParticipantPaymentDraft {
  return {
    id: row.id,
    participantId: row.participantId,
    amountCents: row.amountCents,
    currency: row.currency,
    paidAt: row.paidAt,
    label: row.label,
    notes: row.notes,
  };
}

function mapSupplierPayment(
  row: typeof tripSupplierPayments.$inferSelect,
): SupplierPaymentDraft {
  return {
    id: row.id,
    costLineItemId: row.costLineItemId,
    paidAt: row.paidAt,
    paidByType: row.paidByType as PaidByType,
    paidByName: row.paidByName,
    paidTo: row.paidTo,
    amountCents: row.amountCents,
    currency: row.currency,
    paymentMethod: row.paymentMethod as SupplierPaymentMethod,
    reference: row.reference,
    receiptStatus: row.receiptStatus,
    reimbursementNeeded: row.reimbursementNeeded,
    notes: row.notes,
  };
}

export async function loadCostLedgerRaw(tripId: string): Promise<CostLedgerRaw> {
  const [settingsRow, lines, funds, payments, supplierPayments] = await Promise.all([
    db
      .select()
      .from(tripCostSettings)
      .where(eq(tripCostSettings.tripId, tripId))
      .limit(1)
      .then((rows) => rows[0]),
    db
      .select()
      .from(costLineItems)
      .where(eq(costLineItems.tripId, tripId))
      .orderBy(asc(costLineItems.sortOrder), asc(costLineItems.createdAt)),
    db
      .select()
      .from(tripFunds)
      .where(eq(tripFunds.tripId, tripId))
      .orderBy(asc(tripFunds.sortOrder), asc(tripFunds.createdAt)),
    db
      .select()
      .from(participantPayments)
      .where(eq(participantPayments.tripId, tripId))
      .orderBy(asc(participantPayments.paidAt)),
    db
      .select()
      .from(tripSupplierPayments)
      .where(eq(tripSupplierPayments.tripId, tripId))
      .orderBy(asc(tripSupplierPayments.paidAt)),
  ]);

  const lineIds = lines.map((line) => line.id);
  const overrideRows =
    lineIds.length > 0
      ? await db
          .select()
          .from(costAllocationOverrides)
          .where(inArray(costAllocationOverrides.lineItemId, lineIds))
      : [];

  const overrides: CostAllocationOverrideDraft[] = overrideRows.map((row) => ({
    lineItemId: row.lineItemId,
    participantId: row.participantId,
    amountCents: row.amountCents,
  }));

  return {
    settings: mapSettings(settingsRow),
    lineItems: lines.map(mapLine),
    overrides,
    funds: funds.map(mapFund),
    payments: payments.map(mapPayment),
    supplierPayments: supplierPayments.map(mapSupplierPayment),
  };
}

export async function ensureCostSettings(tripId: string): Promise<TripCostSettingsDraft> {
  const existing = await db
    .select()
    .from(tripCostSettings)
    .where(eq(tripCostSettings.tripId, tripId))
    .limit(1)
    .then((rows) => rows[0]);
  if (existing) return mapSettings(existing);

  await db.insert(tripCostSettings).values({ tripId });
  return mapSettings(undefined);
}
