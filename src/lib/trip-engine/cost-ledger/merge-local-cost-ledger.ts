import { isManualFinanceLine } from "./finance-sections";
import { isOptimisticFinanceLineId } from "./optimistic-finance-patch";
import { linkedEntityExistsInGraph } from "./prune-cost-ledger-orphans";
import type { TripEntityGraph } from "../types";
import type { CostLedgerProjection, CostLineItemDraft } from "./types";

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

/** True when local draft has finance rows or settings the server snapshot does not yet include. */
export function localCostLedgerIsAhead(
  local: CostLedgerProjection | null | undefined,
  server: CostLedgerProjection | null | undefined,
  graph?: TripEntityGraph | null,
): boolean {
  if (!local) return false;
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
  return localHasUnsyncedLinkedLines(local, server, graph);
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
  const ahead = localCostLedgerIsAhead(local, server, graph);
  if (!ahead) return server;

  const serverIds = new Set(server.lineItems.map((line) => line.id));
  const linkedOnServer = serverLinkKeys(server);
  const localOnlyLines = local.lineItems.filter((line) => {
    if (serverIds.has(line.id)) return false;
    if (graph && !linkedEntityExistsInGraph(line, graph)) return false;
    const linkKey = primaryLinkKey(line);
    if (linkKey && linkedOnServer.has(linkKey)) return false;
    return isOptimisticFinanceLineId(line.id) || !serverIds.has(line.id);
  });
  if (!localOnlyLines.length && !hasOptimisticFinanceSections(local.settings)) {
    return server;
  }

  const localOnlyIds = new Set(localOnlyLines.map((line) => line.id));
  const localById = new Map(local.lineItems.map((line) => [line.id, line]));

  const mergedLineItems = [
    ...server.lineItems.map((line) => localById.get(line.id) ?? line),
    ...localOnlyLines.filter((line) => !serverIds.has(line.id)),
  ];

  const mergedAllocations = [
    ...server.lineAllocations.filter((row) => !localOnlyIds.has(row.lineItemId)),
    ...local.lineAllocations.filter((row) => localOnlyIds.has(row.lineItemId)),
  ];

  const serverSectionIds = new Set(
    server.settings.financeCustomSections.map((section) => section.id),
  );
  const extraSections = local.settings.financeCustomSections.filter(
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
