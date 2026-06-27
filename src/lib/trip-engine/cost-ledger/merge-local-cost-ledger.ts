import { isManualFinanceLine } from "./finance-sections";
import { isOptimisticFinanceLineId } from "./optimistic-finance-patch";
import { linkedEntityExistsInGraph } from "./prune-cost-ledger-orphans";
import type { TripEntityGraph } from "../types";
import type { CostLedgerProjection, CostLineItemDraft, LineAllocationResult } from "./types";

export function primaryLinkKey(line: CostLineItemDraft): string | null {
  if (line.linkedActivityId) return `activity:${line.linkedActivityId}`;
  if (line.linkedStayId) return `stay:${line.linkedStayId}`;
  if (line.linkedTransportProductId) return `transport_product:${line.linkedTransportProductId}`;
  if (line.linkedTransportLegId) return `transport:${line.linkedTransportLegId}`;
  return null;
}

function serverLinkKeys(ledger: CostLedgerProjection): Set<string> {
  return new Set(
    ledger.lineItems
      .map(primaryLinkKey)
      .filter((key): key is string => key != null),
  );
}

function localHasUnsyncedLinkedLines(
  local: CostLedgerProjection,
  server: CostLedgerProjection,
  graph?: TripEntityGraph | null,
): boolean {
  const keys = serverLinkKeys(server);
  return local.lineItems.some((line) => {
    const key = primaryLinkKey(line);
    if (!key || keys.has(key)) return false;
    if (graph && !linkedEntityExistsInGraph(line, graph)) return false;
    return true;
  });
}

function hasOptimisticFinanceSections(settings: CostLedgerProjection["settings"]): boolean {
  return settings.financeCustomSections.some((section) =>
    section.id.startsWith("optimistic-section-"),
  );
}

/** Local session cache ballooned with duplicate optimistic transport seeds. */
export function localCostLedgerIsRunawayDuplicate(
  local: CostLedgerProjection,
  server: CostLedgerProjection | null | undefined,
): boolean {
  if (!server) return false;
  const localTransport = local.lineItems.filter((line) => line.category === "transport").length;
  const serverTransport = server.lineItems.filter((line) => line.category === "transport").length;
  if (localTransport <= serverTransport + 2) return false;
  const optimisticTransport = local.lineItems.filter(
    (line) => line.category === "transport" && isOptimisticFinanceLineId(line.id),
  ).length;
  return optimisticTransport > serverTransport || localTransport > serverTransport * 2;
}

/** Drop duplicate optimistic finance rows cached in sessionStorage. */
export function pruneRunawayLocalFinanceLines(
  local: CostLedgerProjection,
  graph: TripEntityGraph,
): CostLedgerProjection {
  const productIds = new Set((graph.transportProducts ?? []).map((product) => product.id));
  const legIds = new Set(
    [...graph.outboundLegs, ...graph.returnLegs, ...graph.intercityLegs].map((leg) => leg.id),
  );

  const seenProduct = new Set<string>();
  const seenLeg = new Set<string>();
  const orphanDescCount = new Map<string, number>();
  const orphanAllowance = Math.max(productIds.size, 1);

  const kept: CostLineItemDraft[] = [];
  for (const line of local.lineItems) {
    if (line.linkedTransportProductId) {
      if (!productIds.has(line.linkedTransportProductId)) continue;
      if (seenProduct.has(line.linkedTransportProductId)) continue;
      seenProduct.add(line.linkedTransportProductId);
      kept.push(line);
      continue;
    }
    if (line.linkedTransportLegId) {
      if (!legIds.has(line.linkedTransportLegId)) continue;
      if (seenLeg.has(line.linkedTransportLegId)) continue;
      seenLeg.add(line.linkedTransportLegId);
      kept.push(line);
      continue;
    }
    if (
      line.category === "transport" &&
      !line.linkedStayId &&
      !line.linkedActivityId
    ) {
      const desc = line.description.trim();
      const count = orphanDescCount.get(desc) ?? 0;
      if (count >= orphanAllowance) continue;
      orphanDescCount.set(desc, count + 1);
      kept.push(line);
      continue;
    }
    kept.push(line);
  }

  if (kept.length === local.lineItems.length) return local;
  const keepIds = new Set(kept.map((line) => line.id));
  return {
    ...local,
    lineItems: kept,
    lineAllocations: local.lineAllocations.filter((row) => keepIds.has(row.lineItemId)),
  };
}

/** Local pinned per-person amounts not yet reflected on the server snapshot. */
export function localAllocIsAheadOfServer(
  local: LineAllocationResult,
  server: LineAllocationResult | undefined,
): boolean {
  if (!server) {
    return local.pinnedParticipantIds.length > 0 || local.allocatedTotalCents > 0;
  }
  if (local.pinnedParticipantIds.length > server.pinnedParticipantIds.length) return true;
  if (local.allocatedTotalCents > server.allocatedTotalCents) return true;
  for (const participantId of local.pinnedParticipantIds) {
    if ((local.allocations[participantId] ?? 0) > (server.allocations[participantId] ?? 0)) {
      return true;
    }
  }
  return false;
}

function localHasUnsyncedPinnedAllocations(
  local: CostLedgerProjection,
  server: CostLedgerProjection,
): boolean {
  const serverByLine = new Map(server.lineAllocations.map((row) => [row.lineItemId, row]));
  return local.lineAllocations.some((row) =>
    localAllocIsAheadOfServer(row, serverByLine.get(row.lineItemId)),
  );
}

function preferAheadLineAllocation(
  local: LineAllocationResult | undefined,
  server: LineAllocationResult | undefined,
): LineAllocationResult | undefined {
  if (!local) return server;
  if (!server) return local;
  if (localAllocIsAheadOfServer(local, server)) return local;
  return server;
}

function mergeLineAllocations(
  local: CostLedgerProjection,
  server: CostLedgerProjection,
): LineAllocationResult[] {
  const localByLine = new Map(local.lineAllocations.map((row) => [row.lineItemId, row]));
  const serverByLine = new Map(server.lineAllocations.map((row) => [row.lineItemId, row]));
  const lineIds = new Set([...localByLine.keys(), ...serverByLine.keys()]);
  return [...lineIds]
    .map((lineItemId) =>
      preferAheadLineAllocation(localByLine.get(lineItemId), serverByLine.get(lineItemId)),
    )
    .filter((row): row is LineAllocationResult => row != null);
}

/** True when local draft has finance rows or settings the server snapshot does not yet include. */
export function localCostLedgerIsAhead(
  local: CostLedgerProjection | null | undefined,
  server: CostLedgerProjection | null | undefined,
  graph?: TripEntityGraph | null,
): boolean {
  if (!local) return false;
  if (server && localCostLedgerIsRunawayDuplicate(local, server)) return false;
  if (hasOptimisticFinanceSections(local.settings)) return true;
  if (!local.lineItems.length) return false;
  if (!server) {
    return local.lineItems.some(
      (line) => isOptimisticFinanceLineId(line.id) || isManualFinanceLine(line),
    );
  }
  const serverIds = new Set(server.lineItems.map((line) => line.id));
  if (
    local.lineItems.some(
      (line) =>
        isOptimisticFinanceLineId(line.id) ||
        (isManualFinanceLine(line) && !serverIds.has(line.id)),
    )
  ) {
    return true;
  }
  return (
    localHasUnsyncedLinkedLines(local, server, graph) ||
    localHasUnsyncedPinnedAllocations(local, server)
  );
}

/**
 * Prefer unsynced local finance rows when a background setup refresh returns a stale ledger.
 * Shared line ids use the server row; local-only rows and their allocations are preserved.
 */
export function mergePreferLocalCostLedger(
  local: CostLedgerProjection | null | undefined,
  server: CostLedgerProjection | null | undefined,
  options?: { forceKeepLocal?: boolean; graph?: TripEntityGraph | null },
): CostLedgerProjection | null | undefined {
  if (!server) return local;
  if (!local) return server;
  if (options?.forceKeepLocal) return local;

  const graph = options?.graph ?? null;
  const prunedLocal = graph ? pruneRunawayLocalFinanceLines(local, graph) : local;
  if (localCostLedgerIsRunawayDuplicate(prunedLocal, server)) return server;

  const ahead = localCostLedgerIsAhead(prunedLocal, server, graph);
  const allocationAhead = localHasUnsyncedPinnedAllocations(prunedLocal, server);
  if (!ahead && !allocationAhead) return server;

  const serverIds = new Set(server.lineItems.map((line) => line.id));
  const linkedOnServer = serverLinkKeys(server);
  const localOnlyLines = prunedLocal.lineItems.filter((line) => {
    if (serverIds.has(line.id)) return false;
    if (graph && !linkedEntityExistsInGraph(line, graph)) return false;
    const linkKey = primaryLinkKey(line);
    if (linkKey && linkedOnServer.has(linkKey)) return false;
    return isOptimisticFinanceLineId(line.id) || !serverIds.has(line.id);
  });
  if (
    !localOnlyLines.length &&
    !hasOptimisticFinanceSections(local.settings) &&
    !allocationAhead
  ) {
    return server;
  }

  const localOnlyIds = new Set(localOnlyLines.map((line) => line.id));
  const localById = new Map(prunedLocal.lineItems.map((line) => [line.id, line]));
  const localAllocByLine = new Map(
    prunedLocal.lineAllocations.map((row) => [row.lineItemId, row]),
  );
  const serverAllocByLine = new Map(
    server.lineAllocations.map((row) => [row.lineItemId, row]),
  );

  const mergedLineItems = [
    ...server.lineItems.map((line) => {
      const localLine = localById.get(line.id);
      if (!localLine) return line;
      const localAlloc = localAllocByLine.get(line.id);
      if (
        localAlloc &&
        localAllocIsAheadOfServer(localAlloc, serverAllocByLine.get(line.id)) &&
        localLine.totalAmountCents > line.totalAmountCents
      ) {
        return localLine;
      }
      return localLine.totalAmountCents > line.totalAmountCents ? localLine : line;
    }),
    ...localOnlyLines.filter((line) => !serverIds.has(line.id)),
  ];

  const mergedAllocations = allocationAhead
    ? mergeLineAllocations(prunedLocal, server)
    : [
        ...server.lineAllocations.filter((row) => !localOnlyIds.has(row.lineItemId)),
        ...prunedLocal.lineAllocations.filter((row) => localOnlyIds.has(row.lineItemId)),
      ];

  const serverSectionIds = new Set(
    server.settings.financeCustomSections.map((section) => section.id),
  );
  const extraSections = prunedLocal.settings.financeCustomSections.filter(
    (section) => !serverSectionIds.has(section.id),
  );

  return {
    ...server,
    settings: extraSections.length
      ? {
          ...server.settings,
          financeCustomSections: [
            ...server.settings.financeCustomSections,
            ...extraSections,
          ],
        }
      : server.settings,
    lineItems: mergedLineItems,
    lineAllocations: mergedAllocations,
  };
}
