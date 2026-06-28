import { convertToBaseCents } from "./format-money";
import type {
  CostLedgerProjection,
  CostLineItemDraft,
  LineAllocationResult,
  TripCostSettingsDraft,
} from "./types";

function mergedParticipantTotalCents(
  lineAlloc?: Pick<LineAllocationResult, "allocations" | "allocatedTotalCents"> | null,
  pendingAllocations?: Record<string, number | null> | null,
): number {
  if (!pendingAllocations || Object.keys(pendingAllocations).length === 0) {
    return lineAlloc?.allocatedTotalCents ?? 0;
  }
  const alloc = lineAlloc?.allocations ?? {};
  const participantIds = new Set([...Object.keys(alloc), ...Object.keys(pendingAllocations)]);
  let sum = 0;
  for (const participantId of participantIds) {
    const pending = pendingAllocations[participantId];
    const cents = pending !== undefined ? pending : alloc[participantId];
    if (cents != null && cents > 0) sum += cents;
  }
  return sum;
}

/** Row total for display and section subtotals — includes per-person pins when stored total is still zero. */
export function effectiveLineTotalCents(
  line: Pick<CostLineItemDraft, "totalAmountCents">,
  lineAlloc?: Pick<
    LineAllocationResult,
    "allocatedTotalCents" | "pinnedParticipantIds" | "allocations"
  > | null,
  pendingAllocations?: Record<string, number | null> | null,
  pendingLineTotalCents?: number | null,
): number {
  if (pendingLineTotalCents != null && pendingLineTotalCents >= 0) {
    return pendingLineTotalCents;
  }

  const stored = line.totalAmountCents;
  const allocated = lineAlloc?.allocatedTotalCents ?? 0;
  const hasPins = (lineAlloc?.pinnedParticipantIds.length ?? 0) > 0;
  const mergedParticipantTotal = mergedParticipantTotalCents(lineAlloc, pendingAllocations);

  if (pendingAllocations && Object.keys(pendingAllocations).length > 0 && mergedParticipantTotal > 0) {
    return Math.max(stored, mergedParticipantTotal);
  }
  if (hasPins || (stored === 0 && allocated > 0) || allocated > stored) {
    return Math.max(stored, allocated);
  }
  return stored;
}

export function sectionLinesSubtotalCents(
  lines: CostLineItemDraft[],
  lineAllocations: LineAllocationResult[],
  settings: TripCostSettingsDraft,
  pendingAllocations?: Record<string, Record<string, number | null>>,
  pendingLineTotals?: Record<string, number>,
): number {
  const allocById = new Map(lineAllocations.map((row) => [row.lineItemId, row]));
  return lines.reduce((sum, line) => {
    const total = effectiveLineTotalCents(
      line,
      allocById.get(line.id),
      pendingAllocations?.[line.id],
      pendingLineTotals?.[line.id],
    );
    return sum + toBase(total, line.currency, settings);
  }, 0);
}

function toBase(
  cents: number,
  currency: string,
  settings: TripCostSettingsDraft,
): number {
  return convertToBaseCents(cents, currency, settings);
}

/** Supplier payments linked to these cost lines (base currency). */
export function supplierPaidCentsForLines(
  lines: CostLineItemDraft[],
  ledger: CostLedgerProjection,
): number {
  const lineIds = new Set(lines.map((l) => l.id));
  const { settings, supplierPayments } = ledger;
  return supplierPayments
    .filter((p) => p.costLineItemId && lineIds.has(p.costLineItemId))
    .reduce((sum, p) => sum + toBase(p.amountCents, p.currency, settings), 0);
}

/** Attribute linked supplier payments to a participant by their share of each line. */
export function supplierPaidCentsForParticipantOnLines(
  lines: CostLineItemDraft[],
  participantId: string,
  ledger: CostLedgerProjection,
  allocationByLine: Map<string, Record<string, number>>,
): number {
  const { settings, supplierPayments } = ledger;
  let total = 0;

  for (const line of lines) {
    const payments = supplierPayments.filter((p) => p.costLineItemId === line.id);
    if (!payments.length) continue;

    const linePaid = payments.reduce(
      (sum, p) => sum + toBase(p.amountCents, p.currency, settings),
      0,
    );
    const lineTotal = toBase(line.totalAmountCents, line.currency, settings);
    if (lineTotal <= 0 || linePaid <= 0) continue;

    const alloc = allocationByLine.get(line.id)?.[participantId] ?? 0;
    const allocBase = toBase(alloc, line.currency, settings);
    if (allocBase <= 0) continue;

    total += Math.round((linePaid * allocBase) / lineTotal);
  }

  return total;
}
