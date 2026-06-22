import { asc, eq, inArray } from "drizzle-orm";

import { db } from "@/lib/db/client";
import {
  costAllocationOverrides,
  costLineItems,
  participantPayments,
  tripCostSettings,
  tripFunds,
} from "@/lib/db/schema";

import type {
  CostAllocationOverrideDraft,
  CostLedgerRaw,
  CostLineItemDraft,
  ParticipantPaymentDraft,
  TripCostSettingsDraft,
  TripFundDraft,
} from "./types";

function mapSettings(row: typeof tripCostSettings.$inferSelect | undefined): TripCostSettingsDraft {
  return {
    baseCurrency: row?.baseCurrency ?? "NZD",
    foreignCurrency: row?.foreignCurrency ?? null,
    exchangeRate: row?.exchangeRate ? Number(row.exchangeRate) : null,
    exchangeRateDate: row?.exchangeRateDate ?? null,
    exchangeRateManual: row?.exchangeRateManual ?? false,
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
    },
    linkedStayId: row.linkedStayId,
    linkedTransportLegId: row.linkedTransportLegId,
    linkedActivityId: row.linkedActivityId,
    scope: row.scope ?? "presence",
    supplierPaymentStatus: row.supplierPaymentStatus,
  };
}

function mapFund(row: typeof tripFunds.$inferSelect): TripFundDraft {
  const payload = (row.allocationRulePayload ?? {}) as Record<string, string>;
  return {
    id: row.id,
    name: row.name,
    amountCents: row.amountCents,
    currency: row.currency,
    allocationRuleType: row.allocationRuleType,
    allocationRulePayload: {
      groupId: payload.groupId,
      participantId: payload.participantId,
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

export async function loadCostLedgerRaw(tripId: string): Promise<CostLedgerRaw> {
  const [settingsRow, lines, funds, payments] = await Promise.all([
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
