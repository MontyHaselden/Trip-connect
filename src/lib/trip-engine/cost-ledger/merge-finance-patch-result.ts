import { localAllocIsAheadOfServer } from "./merge-local-cost-ledger";
import type { CostLedgerProjection } from "./types";

/** Keep optimistic grid rows when the server snapshot lags behind a just-saved edit. */
export function mergeFinancePatchResult(
  optimistic: CostLedgerProjection,
  server: CostLedgerProjection,
): CostLedgerProjection {
  const serverLineById = new Map(server.lineItems.map((line) => [line.id, line]));
  const optimisticAllocByLine = new Map(
    optimistic.lineAllocations.map((row) => [row.lineItemId, row]),
  );
  const serverAllocByLine = new Map(server.lineAllocations.map((row) => [row.lineItemId, row]));
  const optimisticLineById = new Map(optimistic.lineItems.map((line) => [line.id, line]));

  const lineItems = optimistic.lineItems.map((line) => {
    const saved = serverLineById.get(line.id);
    if (!saved) return line;
    const optimisticAlloc = optimisticAllocByLine.get(line.id);
    const serverAlloc = serverAllocByLine.get(line.id);
    if (optimisticAlloc && localAllocIsAheadOfServer(optimisticAlloc, serverAlloc)) {
      return line.totalAmountCents >= saved.totalAmountCents ? line : saved;
    }
    return saved;
  });

  for (const saved of server.lineItems) {
    if (!optimisticLineById.has(saved.id)) {
      lineItems.push(saved);
    }
  }

  const lineAllocations = server.lineAllocations.map((row) => {
    const optimisticAlloc = optimisticAllocByLine.get(row.lineItemId);
    if (optimisticAlloc && localAllocIsAheadOfServer(optimisticAlloc, row)) {
      return optimisticAlloc;
    }
    return row;
  });
  for (const optimisticAlloc of optimistic.lineAllocations) {
    if (!serverAllocByLine.has(optimisticAlloc.lineItemId)) {
      lineAllocations.push(optimisticAlloc);
    }
  }

  return {
    ...optimistic,
    lineItems,
    lineAllocations,
    settings: server.settings,
    funds: server.funds,
    fundAllocations: server.fundAllocations,
    payments: server.payments,
    supplierPayments: server.supplierPayments,
  };
}
