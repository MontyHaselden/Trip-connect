import {
  financeSectionForLine,
  type FinanceEntitySection,
} from "./finance-sections";
import type { CostLineItemDraft } from "./types";
import type { TripEntityGraph } from "../types";

function sortedLines(lines: CostLineItemDraft[]): CostLineItemDraft[] {
  return [...lines].sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
}

/** Reorder lines within one finance tab while preserving other sections' relative order. */
export function reorderFinanceSectionLines(
  lines: CostLineItemDraft[],
  section: FinanceEntitySection,
  orderedIds: string[],
  graph?: TripEntityGraph | null,
): CostLineItemDraft[] {
  const sorted = sortedLines(lines);
  const sectionLines = sorted.filter((line) => financeSectionForLine(line, graph) === section);
  const sectionIdSet = new Set(sectionLines.map((line) => line.id));

  if (orderedIds.length !== sectionLines.length) {
    throw new Error("Ordered ids must match section line count.");
  }
  if (!orderedIds.every((id) => sectionIdSet.has(id))) {
    throw new Error("Ordered ids must belong to the section.");
  }

  const byId = new Map(sectionLines.map((line) => [line.id, line]));
  const reorderedSection = orderedIds.map((id) => byId.get(id)!);

  let sectionIdx = 0;
  const merged = sorted.map((line) => {
    if (financeSectionForLine(line, graph) !== section) return line;
    return reorderedSection[sectionIdx++]!;
  });

  return merged.map((line, index) => ({ ...line, sortOrder: index }));
}

/** Insert index for a new manual line at the bottom of a finance tab. */
export function sortOrderForSectionAppend(
  lines: CostLineItemDraft[],
  section: FinanceEntitySection,
  graph?: TripEntityGraph | null,
): number {
  const sorted = sortedLines(lines);
  let lastIdx = -1;
  for (let i = 0; i < sorted.length; i++) {
    if (financeSectionForLine(sorted[i], graph) === section) lastIdx = i;
  }
  return lastIdx < 0 ? sorted.length : lastIdx + 1;
}

export function applySortOrderInsert(
  lines: CostLineItemDraft[],
  insertAt: number,
): CostLineItemDraft[] {
  const sorted = sortedLines(lines);
  return sorted.map((line) =>
    line.sortOrder >= insertAt ? { ...line, sortOrder: line.sortOrder + 1 } : line,
  );
}
