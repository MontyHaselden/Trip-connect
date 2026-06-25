import type { RosterSummary, TripEntityGraph } from "../types";

import { buildParticipantPresenceMap, computeItemAllocations } from "./allocate";
import { convertToBaseCents } from "./format-money";
import { effectiveLineTotalCents } from "./finance-grid-totals";
import { isAllocationBalanced } from "./smart-split";
import type {
  CostAllocationOverrideDraft,
  CostLedgerProjection,
  CostLedgerRaw,
  CostLineCategory,
  PersonBalance,
} from "./types";
import { COST_CATEGORIES } from "./types";

function toBaseCents(
  amountCents: number,
  currency: string,
  settings: CostLedgerRaw["settings"],
): number {
  return convertToBaseCents(amountCents, currency, settings);
}

function fundAllocationOverrides(
  fund: CostLedgerRaw["funds"][number],
): CostAllocationOverrideDraft[] {
  const pinned = fund.allocationRulePayload.pinnedAllocations;
  if (!pinned) return [];
  return Object.entries(pinned)
    .filter(([, amountCents]) => amountCents > 0)
    .map(([participantId, amountCents]) => ({
      lineItemId: fund.id,
      participantId,
      amountCents,
    }));
}

export function projectCostLedger(
  raw: CostLedgerRaw,
  roster: RosterSummary,
  graph?: TripEntityGraph,
): CostLedgerProjection {
  const presence = graph ? buildParticipantPresenceMap(graph, roster) : undefined;
  const ctx: AllocationContext = { settings: raw.settings, graph, presence };

  const lineAllocations = raw.lineItems.map((line) => {
    const { allocations, eligibleParticipantIds, pinnedParticipantIds } =
      computeItemAllocations(line, roster, raw.overrides, ctx);
    const allocatedTotalCents = Object.values(allocations).reduce((sum, n) => sum + n, 0);
    const effectiveTotal = effectiveLineTotalCents(line, {
      allocatedTotalCents,
      pinnedParticipantIds,
    });
    return {
      lineItemId: line.id,
      allocations,
      eligibleParticipantIds,
      pinnedParticipantIds,
      balanced: isAllocationBalanced(effectiveTotal, allocations),
      allocatedTotalCents,
    };
  });

  const fundAllocations: Record<string, Record<string, number>> = {};
  for (const fund of raw.funds) {
    const { allocations } = computeItemAllocations(
      {
        id: fund.id,
        totalAmountCents: fund.amountCents,
        currency: fund.currency,
        allocationRuleType: fund.allocationRuleType,
        allocationRulePayload: fund.allocationRulePayload,
      },
      roster,
      fundAllocationOverrides(fund),
      ctx,
    );
    fundAllocations[fund.id] = allocations;
  }

  const grossByPerson = new Map<string, number>();
  for (const line of lineAllocations) {
    for (const [participantId, cents] of Object.entries(line.allocations)) {
      const lineItem = raw.lineItems.find((l) => l.id === line.lineItemId);
      const base = lineItem
        ? toBaseCents(cents, lineItem.currency, raw.settings)
        : cents;
      grossByPerson.set(participantId, (grossByPerson.get(participantId) ?? 0) + base);
    }
  }

  const creditsByPerson = new Map<string, number>();
  for (const fund of raw.funds) {
    const allocations = fundAllocations[fund.id] ?? {};
    for (const [participantId, cents] of Object.entries(allocations)) {
      const base = toBaseCents(cents, fund.currency, raw.settings);
      creditsByPerson.set(participantId, (creditsByPerson.get(participantId) ?? 0) + base);
    }
  }

  const paidByPerson = new Map<string, number>();
  for (const payment of raw.payments) {
    const base = toBaseCents(payment.amountCents, payment.currency, raw.settings);
    paidByPerson.set(
      payment.participantId,
      (paidByPerson.get(payment.participantId) ?? 0) + base,
    );
  }

  const participantIds = new Set([
    ...grossByPerson.keys(),
    ...creditsByPerson.keys(),
    ...paidByPerson.keys(),
    ...roster.participants.filter((p) => p.inCostSplit).map((p) => p.id),
  ]);

  const personBalances: PersonBalance[] = [...participantIds].map((participantId) => {
    const grossCents = grossByPerson.get(participantId) ?? 0;
    const fundCreditsCents = creditsByPerson.get(participantId) ?? 0;
    const paidCents = paidByPerson.get(participantId) ?? 0;
    return {
      participantId,
      grossCents,
      fundCreditsCents,
      paidCents,
      balanceCents: grossCents - fundCreditsCents - paidCents,
    };
  });

  const categoryTotals = Object.fromEntries(
    COST_CATEGORIES.map((c) => [c, 0]),
  ) as Record<CostLineCategory, number>;

  for (const line of raw.lineItems) {
    categoryTotals[line.category] += toBaseCents(
      line.totalAmountCents,
      line.currency,
      raw.settings,
    );
  }

  const tripGrossCents = personBalances.reduce((sum, p) => sum + p.grossCents, 0);
  const tripFundCreditsCents = personBalances.reduce((sum, p) => sum + p.fundCreditsCents, 0);
  const tripPaidCents = personBalances.reduce((sum, p) => sum + p.paidCents, 0);

  return {
    settings: raw.settings,
    lineItems: raw.lineItems,
    lineAllocations,
    funds: raw.funds,
    fundAllocations,
    payments: raw.payments,
    supplierPayments: raw.supplierPayments,
    personBalances,
    categoryTotals,
    tripGrossCents,
    tripFundCreditsCents,
    tripPaidCents,
    tripOutstandingCents: tripGrossCents - tripFundCreditsCents - tripPaidCents,
  };
}

export function hasUnbalancedLines(projection: CostLedgerProjection): boolean {
  return projection.lineAllocations.some((line) => !line.balanced);
}
