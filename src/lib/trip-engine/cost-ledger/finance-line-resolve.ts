import { primaryLinkKey } from "./merge-local-cost-ledger";
import { isOptimisticFinanceLineId } from "./optimistic-finance-patch";
import { isServerFinanceLineId } from "./finance-line-delete-plan";
import type { CostLedgerProjection, CostLineItemDraft } from "./types";

export function findServerLineIdForLinkedLine(
  line: CostLineItemDraft,
  ledger: CostLedgerProjection,
): string | null {
  const linkKey = primaryLinkKey(line);
  if (!linkKey) return null;
  const match = ledger.lineItems.find(
    (row) => primaryLinkKey(row) === linkKey && isServerFinanceLineId(row.id),
  );
  return match?.id ?? null;
}

/** Map a grid row id (including optimistic seeds) to a persisted cost line id when possible. */
export function resolveFinanceLineIdForServer(
  lineId: string,
  ledger: CostLedgerProjection,
  mapping: ReadonlyMap<string, string>,
): string | null {
  const mapped = mapping.get(lineId);
  if (mapped && isServerFinanceLineId(mapped)) return mapped;
  if (isServerFinanceLineId(lineId)) return lineId;

  const line = ledger.lineItems.find((row) => row.id === lineId);
  if (!line) return null;

  return findServerLineIdForLinkedLine(line, ledger);
}

export function ledgerHasUnmaterializedLinkedLines(ledger: CostLedgerProjection): boolean {
  return ledger.lineItems.some(
    (line) => isOptimisticFinanceLineId(line.id) && Boolean(primaryLinkKey(line)),
  );
}

export function remapOptimisticFinanceLineIds(
  ledger: CostLedgerProjection,
  mapping: Map<string, string>,
): void {
  for (const line of ledger.lineItems) {
    if (!isOptimisticFinanceLineId(line.id)) continue;
    const serverId = findServerLineIdForLinkedLine(line, ledger);
    if (serverId) mapping.set(line.id, serverId);
  }
}
