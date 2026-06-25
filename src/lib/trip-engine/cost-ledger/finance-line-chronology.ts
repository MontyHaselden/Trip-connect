import type { TripEntityGraph } from "../types";

import { financeSectionForLine, type FinanceEntitySection } from "./finance-sections";
import type { CostLineItemDraft } from "./types";

/** ISO date for calendar-linked rows; YYYY-MM-DD prefix from description as fallback. */
export function financeLineChronologicalKey(
  line: CostLineItemDraft,
  graph?: TripEntityGraph | null,
): string | null {
  if (graph) {
    if (line.linkedStayId) {
      const stay = graph.accommodationStays.find((s) => s.id === line.linkedStayId);
      if (stay?.checkInDate) return stay.checkInDate;
    }
    if (line.linkedTransportProductId) {
      const legs = [
        ...graph.outboundLegs,
        ...graph.returnLegs,
        ...graph.intercityLegs,
      ]
        .filter((leg) => leg.transportProductId === line.linkedTransportProductId)
        .sort((a, b) => String(a.travelDate).localeCompare(String(b.travelDate)));
      if (legs[0]?.travelDate) return String(legs[0].travelDate);
    }
    if (line.linkedTransportLegId) {
      const leg = [
        ...graph.outboundLegs,
        ...graph.returnLegs,
        ...graph.intercityLegs,
      ].find((l) => l.id === line.linkedTransportLegId);
      if (leg?.travelDate) return String(leg.travelDate);
    }
    if (line.linkedActivityId) {
      const activity = graph.activities.find((a) => a.id === line.linkedActivityId);
      if (activity?.date) return activity.date;
    }
  }

  const fromDescription = line.description.match(/^(\d{4}-\d{2}-\d{2})/);
  if (fromDescription?.[1]) return fromDescription[1];

  if (line.notes?.match(/^\d{4}-\d{2}-\d{2}/)) {
    return line.notes.slice(0, 10);
  }

  return null;
}

export function isCalendarLinkedFinanceLine(line: CostLineItemDraft): boolean {
  return Boolean(
    line.linkedStayId ||
      line.linkedTransportLegId ||
      line.linkedTransportProductId ||
      line.linkedActivityId,
  );
}

function isTransportProductFinanceLine(line: CostLineItemDraft): boolean {
  return Boolean(line.linkedTransportProductId);
}

/**
 * Calendar-linked rows sort by trip date; manual extras keep their drag position.
 * Walks the current sortOrder and swaps linked rows into chronological order.
 */
export function orderFinanceSectionLines(
  lines: CostLineItemDraft[],
  graph?: TripEntityGraph | null,
): CostLineItemDraft[] {
  const sorted = [...lines].sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
  const linked = sorted.filter((line) => isCalendarLinkedFinanceLine(line));
  if (linked.length < 2) return sorted;

  const chronoQueue = [...linked].sort((a, b) => {
    const aProduct = isTransportProductFinanceLine(a);
    const bProduct = isTransportProductFinanceLine(b);
    if (aProduct !== bProduct) return aProduct ? 1 : -1;

    const keyA = financeLineChronologicalKey(a, graph) ?? "9999-99-99";
    const keyB = financeLineChronologicalKey(b, graph) ?? "9999-99-99";
    const dateCmp = keyA.localeCompare(keyB);
    if (dateCmp !== 0) return dateCmp;
    return a.sortOrder - b.sortOrder || a.id.localeCompare(b.id);
  });

  let chronoIdx = 0;
  return sorted.map((line) => {
    if (!isCalendarLinkedFinanceLine(line)) return line;
    return chronoQueue[chronoIdx++]!;
  });
}
