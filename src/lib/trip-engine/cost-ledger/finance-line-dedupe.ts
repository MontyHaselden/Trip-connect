import { duplicateActivityIdsForFinance } from "../merge-graph-activities";
import type { TripEntityGraph } from "../types";
import { isServerFinanceLineId } from "./finance-line-delete-plan";
import type { CostLineItemDraft } from "./types";

export type FinanceLineDedupeFields = Pick<
  CostLineItemDraft,
  | "id"
  | "category"
  | "description"
  | "notes"
  | "totalAmountCents"
  | "sortOrder"
  | "linkedStayId"
  | "linkedTransportLegId"
  | "linkedTransportProductId"
  | "linkedActivityId"
>;

export function scoreFinanceLine(
  line: Pick<CostLineItemDraft, "id" | "totalAmountCents" | "sortOrder">,
): number {
  const total = line.totalAmountCents ?? 0;
  const serverBonus = isServerFinanceLineId(line.id) ? 1_000_000 : 0;
  return total * 1_000 + serverBonus - line.sortOrder;
}

/** @deprecated Use scoreFinanceLine */
export const scoreActivityFinanceLine = scoreFinanceLine;

export function financeLinePrimaryLinkKey(
  line: Pick<
    CostLineItemDraft,
    "linkedActivityId" | "linkedStayId" | "linkedTransportLegId" | "linkedTransportProductId"
  >,
): string | null {
  if (line.linkedActivityId) return `activity:${line.linkedActivityId}`;
  if (line.linkedStayId) return `stay:${line.linkedStayId}`;
  if (line.linkedTransportProductId) return `transport_product:${line.linkedTransportProductId}`;
  if (line.linkedTransportLegId) return `transport:${line.linkedTransportLegId}`;
  return null;
}

/** Stable fingerprint for activity finance rows (title + calendar day). */
export function activityFinanceContentKey(
  line: Pick<CostLineItemDraft, "category" | "description" | "notes">,
): string | null {
  if (line.category !== "activities") return null;
  const title = line.description.trim().toLowerCase();
  if (!title) return null;
  const date = line.notes?.trim().slice(0, 10) ?? "";
  return `${date}|${title}`;
}

/** Content fingerprint for unlinked rows, plus activity rows (even when linked). */
export function financeLineContentKey(
  line: Pick<CostLineItemDraft, "category" | "description" | "notes"> &
    Pick<
      CostLineItemDraft,
      "linkedStayId" | "linkedTransportLegId" | "linkedTransportProductId" | "linkedActivityId"
    >,
): string | null {
  if (line.category === "activities") return activityFinanceContentKey(line);
  if (financeLinePrimaryLinkKey(line)) return null;

  return financeSeedContentKey(line);
}

/** Content fingerprint used when blocking duplicate seeds (includes linked rows). */
export function financeSeedContentKey(
  line: Pick<CostLineItemDraft, "category" | "description" | "notes">,
): string | null {
  if (line.category === "activities") return activityFinanceContentKey(line);

  const description = line.description.trim().toLowerCase();
  if (!description) return null;

  if (line.category === "accommodation") {
    const dates = line.notes?.trim() ?? "";
    return `accommodation:${dates}:${description}`;
  }
  if (line.category === "transport" || line.category === "flights") {
    return `transport:${description}`;
  }
  return null;
}

function pickBestFinanceLine<T extends Pick<CostLineItemDraft, "id" | "totalAmountCents" | "sortOrder">>(
  lines: T[],
): T {
  return lines.reduce((best, line) =>
    scoreFinanceLine(line) > scoreFinanceLine(best) ? line : best,
  );
}

/** One visible finance row per linked entity id and per orphan content fingerprint. */
export function canonicalFinanceLineIds(
  lines: FinanceLineDedupeFields[],
  graph?: TripEntityGraph | null,
): Set<string> {
  const duplicateActivityIds = graph ?
    duplicateActivityIdsForFinance(graph.activities)
  : new Map<string, string>();

  const byPrimaryLink = new Map<string, FinanceLineDedupeFields[]>();
  const byContentKey = new Map<string, FinanceLineDedupeFields[]>();

  for (const line of lines) {
    if (line.linkedActivityId && duplicateActivityIds.has(line.linkedActivityId)) continue;

    const linkKey = financeLinePrimaryLinkKey(line);
    if (linkKey) {
      const bucket = byPrimaryLink.get(linkKey) ?? [];
      bucket.push(line);
      byPrimaryLink.set(linkKey, bucket);
    }

    const contentKey = financeLineContentKey(line);
    if (contentKey) {
      const bucket = byContentKey.get(contentKey) ?? [];
      bucket.push(line);
      byContentKey.set(contentKey, bucket);
    }
  }

  const visible = new Set<string>();
  for (const group of byPrimaryLink.values()) {
    visible.add(pickBestFinanceLine(group).id);
  }
  for (const group of byContentKey.values()) {
    visible.add(pickBestFinanceLine(group).id);
  }
  return visible;
}

/** Finance row ids that should be removed from the ledger (non-canonical duplicates). */
export function financeLineIdsToDrop(
  lines: FinanceLineDedupeFields[],
  graph?: TripEntityGraph | null,
): Set<string> {
  const canonical = canonicalFinanceLineIds(lines, graph);
  const drop = new Set<string>();

  for (const line of lines) {
    if (line.linkedActivityId && graph) {
      if (duplicateActivityIdsForFinance(graph.activities).has(line.linkedActivityId)) {
        drop.add(line.id);
        continue;
      }
    }

    const linkKey = financeLinePrimaryLinkKey(line);
    const contentKey = financeLineContentKey(line);
    if (!linkKey && !contentKey) continue;
    if (!canonical.has(line.id)) drop.add(line.id);
  }

  return drop;
}

export function isCanonicalFinanceLine(
  line: CostLineItemDraft,
  graph?: TripEntityGraph | null,
  canonicalIds?: Set<string>,
): boolean {
  if (line.linkedActivityId && graph) {
    if (duplicateActivityIdsForFinance(graph.activities).has(line.linkedActivityId)) {
      return false;
    }
  }
  if (!canonicalIds) return true;

  const linkKey = financeLinePrimaryLinkKey(line);
  const contentKey = financeLineContentKey(line);
  if (!linkKey && !contentKey) return true;
  return canonicalIds.has(line.id);
}
