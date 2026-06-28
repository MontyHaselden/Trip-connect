import { duplicateActivityIdsForFinance } from "../merge-graph-activities";
import type { TripEntityGraph } from "../types";
import type { CostLineItemDraft } from "./types";
import {
  activityFinanceContentKey,
  canonicalFinanceLineIds,
} from "./finance-line-dedupe";

export {
  activityFinanceContentKey,
  scoreFinanceLine as scoreActivityFinanceLine,
} from "./finance-line-dedupe";

/** @deprecated Prefer canonicalFinanceLineIds — kept for existing imports. */
export function visibleActivityFinanceLineIds(
  lines: CostLineItemDraft[],
  graph?: TripEntityGraph | null,
): Set<string> {
  const activityLines = lines.filter((line) => line.category === "activities");
  return canonicalFinanceLineIds(activityLines, graph);
}

export function isVisibleActivityFinanceLine(
  line: CostLineItemDraft,
  graph?: TripEntityGraph | null,
  visibleIds?: Set<string>,
): boolean {
  if (line.category !== "activities") return true;
  if (line.linkedActivityId && graph) {
    if (duplicateActivityIdsForFinance(graph.activities).has(line.linkedActivityId)) {
      return false;
    }
  }
  if (!visibleIds) return true;
  if (!line.linkedActivityId && !activityFinanceContentKey(line)) return true;
  return visibleIds.has(line.id);
}
