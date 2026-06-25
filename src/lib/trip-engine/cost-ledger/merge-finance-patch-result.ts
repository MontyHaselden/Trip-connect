import type { CostLedgerProjection } from "./types";

/** Keep optimistic grid rows; refresh allocations and ancillary ledger data from the server. */
export function mergeFinancePatchResult(
  optimistic: CostLedgerProjection,
  server: CostLedgerProjection,
): CostLedgerProjection {
  const serverLineById = new Map(server.lineItems.map((line) => [line.id, line]));
  const lineItems = optimistic.lineItems.map((line) => {
    const saved = serverLineById.get(line.id);
    return saved ?? line;
  });

  return {
    ...optimistic,
    lineItems,
    lineAllocations: server.lineAllocations,
    settings: server.settings,
    funds: server.funds,
    fundAllocations: server.fundAllocations,
    payments: server.payments,
    supplierPayments: server.supplierPayments,
  };
}
