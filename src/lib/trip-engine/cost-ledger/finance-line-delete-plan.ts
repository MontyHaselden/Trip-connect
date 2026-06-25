import { buildRemoveFromTripCommands } from "./bulk-delete-finance-lines";
import { dismissalKeyFromLine, type FinanceDismissalKey } from "./finance-dismissals";
import { findServerLineIdForLinkedLine } from "./finance-line-resolve";
import type { CostLedgerProjection, CostLineItemDraft } from "./types";
import { isOptimisticFinanceLineId } from "./optimistic-finance-patch";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isServerFinanceLineId(id: string): boolean {
  return UUID_RE.test(id);
}

export type FinanceDeletePlan = {
  serverLineIds: string[];
  removeFromTripLines: CostLineItemDraft[];
  dismissKeys: FinanceDismissalKey[];
};

function resolveServerLineId(
  rawId: string,
  mapping: ReadonlyMap<string, string>,
): string | null {
  const mapped = mapping.get(rawId);
  if (mapped && isServerFinanceLineId(mapped)) return mapped;
  if (isServerFinanceLineId(rawId)) return rawId;
  return null;
}

/** Split finance deletes into server row ids vs calendar-linked optimistic rows. */
export function planFinanceLineDeletes(
  lineIds: string[],
  mode: "financeOnly" | "removeFromTrip",
  ledger: CostLedgerProjection,
  mapping: ReadonlyMap<string, string>,
): FinanceDeletePlan {
  const serverLineIds: string[] = [];
  const removeFromTripLines: CostLineItemDraft[] = [];
  const dismissKeys: FinanceDismissalKey[] = [];
  const seenServer = new Set<string>();
  const seenDismiss = new Set<string>();

  for (const rawId of lineIds) {
    let serverId = resolveServerLineId(rawId, mapping);
    const line = ledger.lineItems.find((row) => row.id === rawId);

    if (!serverId && line) {
      serverId = findServerLineIdForLinkedLine(line, ledger);
    }

    if (serverId) {
      if (!seenServer.has(serverId)) {
        seenServer.add(serverId);
        serverLineIds.push(serverId);
      }
      if (!isOptimisticFinanceLineId(rawId)) continue;
    }

    if (!isOptimisticFinanceLineId(rawId)) continue;
    if (!line) continue;

    if (mode === "removeFromTrip") {
      removeFromTripLines.push(line);
      continue;
    }

    const key = dismissalKeyFromLine(line);
    if (!key) continue;
    const token = `${key.entityType}:${key.entityId}`;
    if (seenDismiss.has(token)) continue;
    seenDismiss.add(token);
    dismissKeys.push(key);
  }

  return { serverLineIds, removeFromTripLines, dismissKeys };
}

export function removeFromTripCommandsForLines(
  graph: Parameters<typeof buildRemoveFromTripCommands>[0],
  lines: CostLineItemDraft[],
) {
  return buildRemoveFromTripCommands(graph, lines);
}
