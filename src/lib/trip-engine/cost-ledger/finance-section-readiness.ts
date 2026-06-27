import { lineIsIntentionallyNoCost, lineIsTbc } from "./finance-metadata";
import {
  financeSectionForLine,
  groupLinesByFinanceSection,
  isManualFinanceLine,
  type FinanceBuiltInSection,
} from "./finance-sections";
import { effectiveLineTotalCents } from "./finance-grid-totals";
import { isAllocationBalanced } from "./smart-split";
import { allTransportLegs } from "./transport-finance-product";
import { financeSeedAccommodationStays } from "./accommodation-finance-leg";
import type { CostLedgerProjection, CostLineItemDraft, LineAllocationResult } from "./types";
import type { TripEntityGraph } from "../types";
import type { AccommodationStayDraft } from "@/lib/host/wizard/types";

export type FinanceSectionAllocationStatus = {
  section: FinanceBuiltInSection;
  /** Finance rows that still need cost and/or per-person allocation. */
  unallocatedCount: number;
  /** Rows marked to be confirmed — priced later, shown as amber in nav. */
  tbcCount: number;
  /** Manual finance-only rows with no calendar entity yet. */
  financeOnlyCount: number;
};

function isPlaceholderFinanceLine(line: CostLineItemDraft): boolean {
  return line.description.trim() === "New line" && line.totalAmountCents === 0;
}

function allocationForLine(
  ledger: CostLedgerProjection,
  lineId: string,
): LineAllocationResult | undefined {
  return ledger.lineAllocations.find((row) => row.lineItemId === lineId);
}

function mergeAllocationAmounts(
  allocation: LineAllocationResult | undefined,
  pendingRow?: Record<string, number | null> | null,
): Record<string, number> {
  const merged: Record<string, number> = { ...(allocation?.allocations ?? {}) };
  if (!pendingRow) return merged;
  for (const [participantId, cents] of Object.entries(pendingRow)) {
    if (cents == null || cents <= 0) delete merged[participantId];
    else merged[participantId] = cents;
  }
  return merged;
}

function effectiveAllocatedTotalCents(
  allocation: LineAllocationResult | undefined,
  pendingRow?: Record<string, number | null> | null,
): number {
  return Object.values(mergeAllocationAmounts(allocation, pendingRow)).reduce(
    (sum, cents) => sum + cents,
    0,
  );
}

/** Plain-language reason a finance row still needs attention — null when complete. */
export function lineFinanceAttentionReason(
  line: CostLineItemDraft,
  ledger: CostLedgerProjection,
  pendingRow?: Record<string, number | null> | null,
): string | null {
  if (isPlaceholderFinanceLine(line)) return null;
  if (lineIsIntentionallyNoCost(line)) return null;
  if (lineIsTbc(line)) return null;

  const allocation = allocationForLine(ledger, line.id);
  const total = effectiveLineTotalCents(line, allocation, pendingRow ?? undefined);
  const allocated = effectiveAllocatedTotalCents(allocation, pendingRow);

  if (total === 0) {
    return isManualFinanceLine(line)
      ? "Add a total price for this finance-only row"
      : "Add a total price in the Total column";
  }

  if (allocated === total) {
    return null;
  }

  const mergedAllocations = mergeAllocationAmounts(allocation, pendingRow);
  if (isAllocationBalanced(total, mergedAllocations)) {
    return null;
  }

  if (allocated <= 0) {
    return "Set per-person prices for this row";
  }
  if (allocated < total) {
    return "Per-person amounts are short of the row total — set splits or lower the total";
  }
  if (allocated > total) {
    return "Per-person amounts exceed the row total — adjust splits or raise the total";
  }
  return "Per-person amounts don't add up to the row total";
}

/** A finance row still needs host attention (pricing, calendar link, or participant split). */
export function lineNeedsFinanceAllocation(
  line: CostLineItemDraft,
  ledger: CostLedgerProjection,
): boolean {
  return lineFinanceAttentionReason(line, ledger) != null;
}

export function financeSectionAllocationStatuses(
  ledger: CostLedgerProjection | null | undefined,
  graph: TripEntityGraph,
): FinanceSectionAllocationStatus[] {
  if (!ledger) return [];

  const bySection = groupLinesByFinanceSection(ledger.lineItems, graph, ledger.settings);
  const sections: FinanceBuiltInSection[] = ["accommodation", "transport", "activities"];

  return sections.map((section) => {
    const lines = bySection.get(section) ?? [];
    let unallocatedCount = 0;
    let tbcCount = 0;
    let financeOnlyCount = 0;

    for (const line of lines) {
      if (isPlaceholderFinanceLine(line)) continue;
      if (lineIsTbc(line)) {
        tbcCount += 1;
        continue;
      }
      if (!lineNeedsFinanceAllocation(line, ledger)) continue;
      unallocatedCount += 1;
      if (isManualFinanceLine(line)) financeOnlyCount += 1;
    }

    return { section, unallocatedCount, tbcCount, financeOnlyCount };
  });
}

export function financeSectionAllocationStatus(
  section: FinanceBuiltInSection,
  ledger: CostLedgerProjection | null | undefined,
  graph: TripEntityGraph,
): FinanceSectionAllocationStatus | null {
  return (
    financeSectionAllocationStatuses(ledger, graph).find((row) => row.section === section) ??
    null
  );
}

export function financeSectionAllocationMessage(
  status: FinanceSectionAllocationStatus,
): string {
  const { section, unallocatedCount, tbcCount, financeOnlyCount } = status;
  if (unallocatedCount === 0 && tbcCount === 0) return "";

  const label =
    section === "accommodation"
      ? "stay"
      : section === "transport"
        ? "transport"
        : "activity";

  const plural = unallocatedCount === 1 ? label : `${label} costs`;

  if (unallocatedCount > 0) {
    if (financeOnlyCount > 0 && financeOnlyCount === unallocatedCount) {
      return `${unallocatedCount} in Finance — not on calendar yet`;
    }
    if (financeOnlyCount > 0) {
      return `${unallocatedCount} ${plural} in Finance need allocation (${financeOnlyCount} not on calendar)`;
    }
    return `${unallocatedCount} ${plural} in Finance need allocation`;
  }

  const tbcPlural = tbcCount === 1 ? label : `${label} costs`;
  return `${tbcCount} ${tbcPlural} marked TBC in Finance`;
}

export type EntityFinanceDisplayStatus = "complete" | "needs_attention" | "tbc" | "none";

function linkedLinesForStay(
  stayId: string,
  ledger: CostLedgerProjection,
): CostLineItemDraft[] {
  return ledger.lineItems.filter((line) => line.linkedStayId === stayId);
}

function linkedLinesForTransportLeg(
  leg: { id: string; transportProductId?: string | null },
  ledger: CostLedgerProjection,
): CostLineItemDraft[] {
  return ledger.lineItems.filter((line) => {
    if (line.linkedTransportLegId === leg.id) return true;
    if (
      leg.transportProductId &&
      line.linkedTransportProductId === leg.transportProductId
    ) {
      return true;
    }
    return false;
  });
}

function linkedLinesForActivity(
  activityId: string,
  ledger: CostLedgerProjection,
): CostLineItemDraft[] {
  return ledger.lineItems.filter((line) => line.linkedActivityId === activityId);
}

function entityFinanceDisplayStatus(
  lines: CostLineItemDraft[],
  ledger: CostLedgerProjection,
): EntityFinanceDisplayStatus {
  if (!lines.length) return "none";
  if (lines.some((line) => lineNeedsFinanceAllocation(line, ledger))) {
    return "needs_attention";
  }
  if (lines.some((line) => lineIsTbc(line))) {
    return "tbc";
  }
  return "complete";
}

export function stayFinanceDisplayStatus(
  stayId: string,
  ledger: CostLedgerProjection | null | undefined,
): EntityFinanceDisplayStatus {
  if (!ledger) return "none";
  return entityFinanceDisplayStatus(linkedLinesForStay(stayId, ledger), ledger);
}

/** Named calendar stays should keep finance attention visible even before ledger sync finishes. */
export function stayFinanceDisplayStatusForStay(
  stay: Pick<AccommodationStayDraft, "id" | "name">,
  ledger: CostLedgerProjection | null | undefined,
  graph: TripEntityGraph,
): EntityFinanceDisplayStatus {
  const status = stayFinanceDisplayStatus(stay.id, ledger);
  if (status !== "none") return status;
  const financeEligible = financeSeedAccommodationStays(graph).some((row) => row.id === stay.id);
  return financeEligible ? "needs_attention" : "none";
}

export function transportLegFinanceDisplayStatus(
  leg: { id: string; transportProductId?: string | null },
  ledger: CostLedgerProjection | null | undefined,
): EntityFinanceDisplayStatus {
  if (!ledger) return "none";
  return entityFinanceDisplayStatus(linkedLinesForTransportLeg(leg, ledger), ledger);
}

export function groupedTransportLegFinanceDisplayStatus(
  legs: Array<{ id: string; transportProductId?: string | null }>,
  ledger: CostLedgerProjection | null | undefined,
): EntityFinanceDisplayStatus {
  if (!ledger || !legs.length) return "none";
  const statuses = legs.map((leg) => transportLegFinanceDisplayStatus(leg, ledger));
  if (statuses.some((status) => status === "needs_attention")) return "needs_attention";
  if (statuses.some((status) => status === "tbc")) return "tbc";
  if (statuses.some((status) => status === "complete")) return "complete";
  return statuses[0] ?? "none";
}

export function groupedTransportLegFinanceAttentionReason(
  legs: Array<{ id: string; transportProductId?: string | null }>,
  ledger: CostLedgerProjection | null | undefined,
): string | null {
  for (const leg of legs) {
    const reason = transportLegFinanceAttentionReason(leg, ledger);
    if (reason) return reason;
  }
  return null;
}

export function activityFinanceDisplayStatus(
  activityId: string,
  ledger: CostLedgerProjection | null | undefined,
): EntityFinanceDisplayStatus {
  if (!ledger) return "none";
  return entityFinanceDisplayStatus(linkedLinesForActivity(activityId, ledger), ledger);
}

export function stayFinanceLineId(
  stayId: string,
  ledger: CostLedgerProjection | null | undefined,
): string | null {
  if (!ledger) return null;
  return linkedLinesForStay(stayId, ledger)[0]?.id ?? null;
}

export function transportLegFinanceLineId(
  leg: { id: string; transportProductId?: string | null },
  ledger: CostLedgerProjection | null | undefined,
): string | null {
  if (!ledger) return null;
  return linkedLinesForTransportLeg(leg, ledger)[0]?.id ?? null;
}

export function activityFinanceLineId(
  activityId: string,
  ledger: CostLedgerProjection | null | undefined,
): string | null {
  if (!ledger) return null;
  return linkedLinesForActivity(activityId, ledger)[0]?.id ?? null;
}

export function activityIsMarkedNoCost(
  activityId: string,
  ledger: CostLedgerProjection | null | undefined,
): boolean {
  if (!ledger) return false;
  return linkedLinesForActivity(activityId, ledger).some(lineIsIntentionallyNoCost);
}

export function activityIsMarkedTbc(
  activityId: string,
  ledger: CostLedgerProjection | null | undefined,
): boolean {
  if (!ledger) return false;
  return linkedLinesForActivity(activityId, ledger).some(lineIsTbc);
}

export function activityFinanceAttentionReason(
  activityId: string,
  ledger: CostLedgerProjection | null | undefined,
): string | null {
  if (!ledger) return null;
  for (const line of linkedLinesForActivity(activityId, ledger)) {
    const reason = lineFinanceAttentionReason(line, ledger);
    if (reason) return reason;
  }
  return null;
}

export function stayFinanceAttentionReason(
  stayId: string,
  ledger: CostLedgerProjection | null | undefined,
): string | null {
  if (!ledger) return null;
  for (const line of linkedLinesForStay(stayId, ledger)) {
    const reason = lineFinanceAttentionReason(line, ledger);
    if (reason) return reason;
  }
  return null;
}

export function transportLegFinanceAttentionReason(
  leg: { id: string; transportProductId?: string | null },
  ledger: CostLedgerProjection | null | undefined,
): string | null {
  if (!ledger) return null;
  for (const line of linkedLinesForTransportLeg(leg, ledger)) {
    const reason = lineFinanceAttentionReason(line, ledger);
    if (reason) return reason;
  }
  return null;
}

export function lineFinanceDisplayStatus(
  line: CostLineItemDraft,
  ledger: CostLedgerProjection,
  pendingRow?: Record<string, number | null> | null,
): EntityFinanceDisplayStatus {
  if (lineFinanceAttentionReason(line, ledger, pendingRow)) {
    return "needs_attention";
  }
  if (lineIsTbc(line)) {
    return "tbc";
  }
  return "complete";
}

/** Stay id → finance line id when that row still needs host attention. */
export function stayFinanceAttentionById(
  ledger: CostLedgerProjection | null | undefined,
): Map<string, string> {
  const map = new Map<string, string>();
  if (!ledger) return map;

  for (const line of ledger.lineItems) {
    if (!line.linkedStayId) continue;
    if (!lineNeedsFinanceAllocation(line, ledger)) continue;
    map.set(line.linkedStayId, line.id);
  }

  return map;
}

/** Transport leg id → finance line id (includes legs covered by a product/package line). */
export function transportLegFinanceAttentionById(
  ledger: CostLedgerProjection | null | undefined,
  graph: TripEntityGraph,
): Map<string, string> {
  const map = new Map<string, string>();
  if (!ledger) return map;

  for (const line of ledger.lineItems) {
    if (!lineNeedsFinanceAllocation(line, ledger)) continue;

    if (line.linkedTransportLegId) {
      map.set(line.linkedTransportLegId, line.id);
      continue;
    }

    if (line.linkedTransportProductId) {
      for (const leg of allTransportLegs(graph)) {
        if (leg.transportProductId === line.linkedTransportProductId) {
          map.set(leg.id, line.id);
        }
      }
    }
  }

  return map;
}

/** Activity id → finance line id when that row still needs host attention. */
export function activityFinanceAttentionById(
  ledger: CostLedgerProjection | null | undefined,
): Map<string, string> {
  const map = new Map<string, string>();
  if (!ledger) return map;

  for (const line of ledger.lineItems) {
    if (!line.linkedActivityId) continue;
    if (!lineNeedsFinanceAllocation(line, ledger)) continue;
    map.set(line.linkedActivityId, line.id);
  }

  return map;
}

export function financeActivityLinesForDay(
  ledger: CostLedgerProjection | null | undefined,
  graph: TripEntityGraph,
  dateIso: string,
): CostLineItemDraft[] {
  if (!ledger) return [];

  const lines = ledger.lineItems.filter((line) => {
    if (financeSectionForLine(line, graph, ledger.settings) !== "activities") return false;
    if (!isManualFinanceLine(line)) return false;
    if (isPlaceholderFinanceLine(line)) return false;

    const noteDate = line.notes?.trim().slice(0, 10) ?? "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(noteDate) && noteDate !== dateIso) return false;

    return true;
  });

  return lines.sort((a, b) => a.description.localeCompare(b.description));
}
