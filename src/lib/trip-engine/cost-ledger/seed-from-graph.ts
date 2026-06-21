import type { TripEntityGraph } from "../types";

import type { CostLineItemDraft } from "./types";

function legDescription(from: string, to: string, date: string): string {
  return `${date}: ${from} → ${to}`;
}

export function buildSeedLineItems(graph: TripEntityGraph): Omit<CostLineItemDraft, "id">[] {
  const items: Omit<CostLineItemDraft, "id">[] = [];
  let sortOrder = 0;

  for (const stay of graph.accommodationStays) {
    if (!stay.cityLabel?.trim() && !stay.name?.trim()) continue;
    items.push({
      sortOrder: sortOrder++,
      category: "accommodation",
      description: stay.name?.trim()
        ? `${stay.name} (${stay.cityLabel})`
        : stay.cityLabel,
      notes: `${stay.checkInDate} → ${stay.checkOutDate}`,
      totalAmountCents: 0,
      currency: "NZD",
      quantity: null,
      allocationRuleType: "equal_cost_participants",
      allocationRulePayload: {},
      linkedStayId: stay.id,
      linkedTransportLegId: null,
      linkedActivityId: null,
      supplierPaymentStatus: null,
    });
  }

  const transportLegs = [
    ...graph.outboundLegs,
    ...graph.returnLegs,
    ...graph.intercityLegs,
  ];
  for (const leg of transportLegs) {
    const from =
      "intercityFromCity" in leg && leg.intercityFromCity
        ? String(leg.intercityFromCity)
        : String(leg.fromCity ?? "Unknown");
    const to =
      "intercityToCity" in leg && leg.intercityToCity
        ? String(leg.intercityToCity)
        : String(leg.toCity ?? "Unknown");
    const travelDate = String(leg.travelDate ?? "");
    items.push({
      sortOrder: sortOrder++,
      category: "transport",
      description: legDescription(from, to, travelDate),
      notes: null,
      totalAmountCents: 0,
      currency: "NZD",
      quantity: null,
      allocationRuleType: "equal_cost_participants",
      allocationRulePayload: {},
      linkedStayId: null,
      linkedTransportLegId: leg.id,
      linkedActivityId: null,
      supplierPaymentStatus: null,
    });
  }

  for (const activity of graph.activities) {
    if (!activity.title?.trim()) continue;
    items.push({
      sortOrder: sortOrder++,
      category: "activities",
      description: activity.title,
      notes: activity.date,
      totalAmountCents: 0,
      currency: "NZD",
      quantity: null,
      allocationRuleType: "equal_cost_participants",
      allocationRulePayload: {},
      linkedStayId: null,
      linkedTransportLegId: null,
      linkedActivityId: activity.id,
      supplierPaymentStatus: null,
    });
  }

  return items;
}

export function seedItemsNotYetPresent(
  existing: CostLineItemDraft[],
  seeds: Omit<CostLineItemDraft, "id">[],
): Omit<CostLineItemDraft, "id">[] {
  const linkedStayIds = new Set(existing.map((l) => l.linkedStayId).filter(Boolean));
  const linkedLegIds = new Set(existing.map((l) => l.linkedTransportLegId).filter(Boolean));
  const linkedActivityIds = new Set(existing.map((l) => l.linkedActivityId).filter(Boolean));

  return seeds.filter((seed) => {
    if (seed.linkedStayId && linkedStayIds.has(seed.linkedStayId)) return false;
    if (seed.linkedTransportLegId && linkedLegIds.has(seed.linkedTransportLegId)) return false;
    if (seed.linkedActivityId && linkedActivityIds.has(seed.linkedActivityId)) return false;
    return true;
  });
}
