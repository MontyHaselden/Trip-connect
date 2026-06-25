import { effectiveLineTotalCents } from "./finance-grid-totals";
import { convertToBaseCents } from "./format-money";
import type {
  CostLedgerProjection,
  CostLineItemDraft,
  LineAllocationResult,
  TripCostSettingsDraft,
} from "./types";

export type PendingAllocationRows = Record<string, Record<string, number | null>>;

export function participantAllocationCentsWithPending(
  line: CostLineItemDraft,
  participantId: string,
  allocationByLine: Map<string, Record<string, number>>,
  settings: TripCostSettingsDraft,
  pendingRow?: Record<string, number | null> | null,
): number {
  let alloc = allocationByLine.get(line.id)?.[participantId];
  if (pendingRow && participantId in pendingRow) {
    alloc = pendingRow[participantId] ?? undefined;
  }
  if (alloc == null || alloc <= 0) return 0;
  return convertToBaseCents(alloc, line.currency, settings);
}

export function lineIsVisibleInFinanceBreakdown(
  line: CostLineItemDraft,
  lineAlloc: LineAllocationResult | undefined,
  pendingRow?: Record<string, number | null> | null,
): boolean {
  return effectiveLineTotalCents(line, lineAlloc, pendingRow) > 0;
}

export function buildAllocationByLine(
  lineAllocations: LineAllocationResult[],
): Map<string, Record<string, number>> {
  const map = new Map<string, Record<string, number>>();
  for (const row of lineAllocations) {
    map.set(row.lineItemId, row.allocations);
  }
  return map;
}

export function lineAllocationResult(
  ledger: CostLedgerProjection,
  lineId: string,
): LineAllocationResult | undefined {
  return ledger.lineAllocations.find((row) => row.lineItemId === lineId);
}
