import type {
  CostAllocationOverrideDraft,
  CostLedgerProjection,
  CostLedgerRaw,
} from "./types";

export function projectionToRaw(ledger: CostLedgerProjection): CostLedgerRaw {
  const overrides: CostAllocationOverrideDraft[] = [];
  for (const alloc of ledger.lineAllocations) {
    for (const participantId of alloc.pinnedParticipantIds) {
      overrides.push({
        lineItemId: alloc.lineItemId,
        participantId,
        amountCents: alloc.allocations[participantId] ?? 0,
      });
    }
  }

  return {
    settings: ledger.settings,
    lineItems: ledger.lineItems.map((line) => ({ ...line })),
    overrides,
    funds: ledger.funds.map((fund) => ({ ...fund })),
    payments: ledger.payments.map((payment) => ({ ...payment })),
    supplierPayments: ledger.supplierPayments.map((payment) => ({ ...payment })),
  };
}
