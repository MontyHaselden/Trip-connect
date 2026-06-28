import type { TripEntityGraph } from "../types";

import { isManualFinanceLine } from "./finance-sections";
import { primaryLinkKey } from "./merge-local-cost-ledger";
import { isOptimisticFinanceLineId } from "./optimistic-finance-patch";
import { isServerFinanceLineId } from "./finance-line-delete-plan";
import { buildSeedLineItems, seedItemsNotYetPresent } from "./seed-from-graph";
import type { CostLedgerProjection, CostLineItemDraft } from "./types";

function manualLineFingerprint(line: CostLineItemDraft): string | null {
  if (!line.allocationRulePayload?.financeSection) return null;
  if (!isManualFinanceLine(line)) return null;
  return `${line.allocationRulePayload.financeSection}|${line.description.trim().toLowerCase()}`;
}

export function findServerLineIdForManualLine(
  line: CostLineItemDraft,
  ledger: CostLedgerProjection,
): string | null {
  const fingerprint = manualLineFingerprint(line);
  if (!fingerprint) return null;
  const match = ledger.lineItems.find((row) => {
    if (!isServerFinanceLineId(row.id)) return false;
    return manualLineFingerprint(row) === fingerprint;
  });
  return match?.id ?? null;
}

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

  return (
    findServerLineIdForLinkedLine(line, ledger) ??
    findServerLineIdForManualLine(line, ledger)
  );
}

export function ledgerHasUnmaterializedLinkedLines(ledger: CostLedgerProjection): boolean {
  return ledger.lineItems.some(
    (line) => isOptimisticFinanceLineId(line.id) && Boolean(primaryLinkKey(line)),
  );
}

/** True when graph-linked costs still need server rows or optimistic seeds are pending. */
export function graphHasUnsyncedFinanceSeeds(
  graph: TripEntityGraph,
  ledger: CostLedgerProjection | null,
): boolean {
  if (!ledger) return true;
  if (ledgerHasUnmaterializedLinkedLines(ledger)) return true;
  return seedItemsNotYetPresent(ledger.lineItems, buildSeedLineItems(graph)).length > 0;
}

export function remapOptimisticFinanceLineIds(
  ledger: CostLedgerProjection,
  mapping: Map<string, string>,
): void {
  for (const line of ledger.lineItems) {
    if (!isOptimisticFinanceLineId(line.id)) continue;
    const serverId =
      findServerLineIdForLinkedLine(line, ledger) ??
      findServerLineIdForManualLine(line, ledger);
    if (serverId) mapping.set(line.id, serverId);
  }
}
