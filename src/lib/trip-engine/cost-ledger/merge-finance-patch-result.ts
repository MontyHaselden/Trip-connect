import { isManualFinanceLine } from "./finance-sections";
import { localAllocIsAheadOfServer } from "./merge-local-cost-ledger";
import { isOptimisticFinanceLineId } from "./optimistic-finance-patch";
import type { CostLedgerProjection, CostLineItemDraft, LineAllocationResult } from "./types";

function manualLineFingerprint(line: CostLineItemDraft): string | null {
  if (!line.allocationRulePayload?.financeSection) return null;
  if (!isManualFinanceLine(line)) return null;
  return `${line.allocationRulePayload.financeSection}|${line.description.trim().toLowerCase()}`;
}

function preferLine(a: CostLineItemDraft, b: CostLineItemDraft): CostLineItemDraft {
  const aServer = isOptimisticFinanceLineId(a.id) ? 0 : 1;
  const bServer = isOptimisticFinanceLineId(b.id) ? 0 : 1;
  if (aServer !== bServer) return bServer > aServer ? b : a;
  if (a.totalAmountCents !== b.totalAmountCents) {
    return a.totalAmountCents > b.totalAmountCents ? a : b;
  }
  return bServer > aServer ? b : a;
}

function dedupeManualFinanceLines(lines: CostLineItemDraft[]): CostLineItemDraft[] {
  const manualGroups = new Map<string, CostLineItemDraft[]>();
  const rest: CostLineItemDraft[] = [];

  for (const line of lines) {
    const fingerprint = manualLineFingerprint(line);
    if (!fingerprint) {
      rest.push(line);
      continue;
    }
    const group = manualGroups.get(fingerprint) ?? [];
    group.push(line);
    manualGroups.set(fingerprint, group);
  }

  const dedupedManual = [...manualGroups.values()].map((group) =>
    group.reduce((best, line) => preferLine(best, line)),
  );

  return [...rest, ...dedupedManual];
}

function remapAllocationRow(
  row: LineAllocationResult,
  remapId: (id: string) => string,
): LineAllocationResult {
  return { ...row, lineItemId: remapId(row.lineItemId) };
}

/** Keep optimistic grid rows when the server snapshot lags behind a just-saved edit. */
export function mergeFinancePatchResult(
  optimistic: CostLedgerProjection,
  server: CostLedgerProjection,
  options?: { optimisticLineMap?: ReadonlyMap<string, string> },
): CostLedgerProjection {
  const optimisticLineMap = options?.optimisticLineMap ?? new Map<string, string>();
  const remapId = (id: string) => optimisticLineMap.get(id) ?? id;

  const filteredOptimisticItems = optimistic.lineItems.filter(
    (line) => !(isOptimisticFinanceLineId(line.id) && optimisticLineMap.has(line.id)),
  );

  const serverLineById = new Map(server.lineItems.map((line) => [line.id, line]));

  const optimisticAllocByLine = new Map<string, LineAllocationResult>();
  for (const row of optimistic.lineAllocations) {
    const remapped = remapAllocationRow(row, remapId);
    const existing = optimisticAllocByLine.get(remapped.lineItemId);
    if (!existing || localAllocIsAheadOfServer(remapped, existing)) {
      optimisticAllocByLine.set(remapped.lineItemId, remapped);
    }
  }

  const serverAllocByLine = new Map(server.lineAllocations.map((row) => [row.lineItemId, row]));

  const mergedById = new Map<string, CostLineItemDraft>();

  for (const [optimisticId, serverId] of optimisticLineMap) {
    const optimisticLine = optimistic.lineItems.find((line) => line.id === optimisticId);
    const saved = serverLineById.get(serverId);
    if (!optimisticLine || !saved) continue;
    const targetLine =
      optimisticLine.id === serverId ? optimisticLine : { ...optimisticLine, id: serverId };
    const optimisticAlloc = optimisticAllocByLine.get(serverId);
    const serverAlloc = serverAllocByLine.get(serverId);
    if (optimisticAlloc && localAllocIsAheadOfServer(optimisticAlloc, serverAlloc)) {
      mergedById.set(
        serverId,
        targetLine.totalAmountCents >= saved.totalAmountCents ? targetLine : saved,
      );
    } else {
      mergedById.set(
        serverId,
        saved.totalAmountCents >= targetLine.totalAmountCents ? saved : targetLine,
      );
    }
  }

  for (const line of filteredOptimisticItems) {
    const targetId = remapId(line.id);
    const optimisticLine = targetId === line.id ? line : { ...line, id: targetId };
    const saved = serverLineById.get(targetId);
    const optimisticAlloc = optimisticAllocByLine.get(targetId);
    const serverAlloc = serverAllocByLine.get(targetId);

    if (saved) {
      if (optimisticAlloc && localAllocIsAheadOfServer(optimisticAlloc, serverAlloc)) {
        mergedById.set(
          targetId,
          optimisticLine.totalAmountCents >= saved.totalAmountCents ? optimisticLine : saved,
        );
      } else {
        mergedById.set(
          targetId,
          saved.totalAmountCents >= optimisticLine.totalAmountCents ? saved : optimisticLine,
        );
      }
    } else {
      mergedById.set(targetId, optimisticLine);
    }
  }

  for (const saved of server.lineItems) {
    if (mergedById.has(saved.id)) continue;
    mergedById.set(saved.id, saved);
  }

  const lineItems = dedupeManualFinanceLines([...mergedById.values()]);

  const keptLineIds = new Set(lineItems.map((line) => line.id));
  const lineAllocations: LineAllocationResult[] = [];

  for (const lineId of keptLineIds) {
    const optimisticAlloc = optimisticAllocByLine.get(lineId);
    const serverAlloc = serverAllocByLine.get(lineId);
    if (optimisticAlloc && localAllocIsAheadOfServer(optimisticAlloc, serverAlloc)) {
      lineAllocations.push(optimisticAlloc);
    } else if (serverAlloc) {
      lineAllocations.push(serverAlloc);
    } else if (optimisticAlloc) {
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
