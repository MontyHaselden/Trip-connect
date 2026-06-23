import type { TripEntityGraph } from "../types";

import type { CostLineItemDraft } from "./types";
import { defaultCostLineFinanceFields } from "./finance-metadata";

function legDescription(from: string, to: string, date: string): string {
  return `${date}: ${from} → ${to}`;
}

function seedStay(stay: TripEntityGraph["accommodationStays"][number], sortOrder: number) {
  if (!stay.name?.trim()) return null;
  return {
    sortOrder,
    category: "accommodation" as const,
    description: `${stay.name!.trim()} (${stay.cityLabel})`,
    notes: `${stay.checkInDate} → ${stay.checkOutDate}`,
    totalAmountCents: 0,
    currency: "NZD",
    quantity: null,
    allocationRuleType: "equal_present" as const,
    allocationRulePayload: {},
    linkedStayId: stay.id,
    linkedTransportLegId: null,
    linkedActivityId: null,
    scope: "presence" as const,
    supplierPaymentStatus: null,
    ...defaultCostLineFinanceFields(),
  };
}

function seedLeg(
  leg: TripEntityGraph["outboundLegs"][number] | TripEntityGraph["intercityLegs"][number],
  sortOrder: number,
) {
  const from =
    "intercityFromCity" in leg && leg.intercityFromCity
      ? String(leg.intercityFromCity)
      : String(leg.fromCity ?? "Unknown");
  const to =
    "intercityToCity" in leg && leg.intercityToCity
      ? String(leg.intercityToCity)
      : String(leg.toCity ?? "Unknown");
  const travelDate = String(leg.travelDate ?? "");
  return {
    sortOrder,
    category: "transport" as const,
    description: legDescription(from, to, travelDate),
    notes: null,
    totalAmountCents: 0,
    currency: "NZD",
    quantity: null,
    allocationRuleType: "equal_present" as const,
    allocationRulePayload: {},
    linkedStayId: null,
    linkedTransportLegId: leg.id,
    linkedActivityId: null,
    scope: "presence" as const,
    supplierPaymentStatus: null,
    ...defaultCostLineFinanceFields(),
  };
}

function seedActivity(activity: TripEntityGraph["activities"][number], sortOrder: number) {
  if (!activity.title?.trim()) return null;
  return {
    sortOrder,
    category: "activities" as const,
    description: activity.title,
    notes: activity.date,
    totalAmountCents: 0,
    currency: "NZD",
    quantity: null,
    allocationRuleType: "equal_present" as const,
    allocationRulePayload: {},
    linkedStayId: null,
    linkedTransportLegId: null,
    linkedActivityId: activity.id,
    scope: "presence" as const,
    supplierPaymentStatus: null,
    ...defaultCostLineFinanceFields(),
  };
}

export function buildSeedLineItems(graph: TripEntityGraph): Omit<CostLineItemDraft, "id">[] {
  const items: Omit<CostLineItemDraft, "id">[] = [];
  let sortOrder = 0;

  for (const stay of graph.accommodationStays) {
    const seed = seedStay(stay, sortOrder++);
    if (seed) items.push(seed);
  }

  const transportLegs = [
    ...graph.outboundLegs,
    ...graph.returnLegs,
    ...graph.intercityLegs,
  ];
  for (const leg of transportLegs) {
    items.push(seedLeg(leg, sortOrder++));
  }

  for (const activity of graph.activities) {
    const seed = seedActivity(activity, sortOrder++);
    if (seed) items.push(seed);
  }

  return items;
}

export function seedItemsNotYetPresent(
  existing: CostLineItemDraft[],
  seeds: Omit<CostLineItemDraft, "id">[],
  dismissedKeys: Set<string> = new Set(),
): Omit<CostLineItemDraft, "id">[] {
  const linkedStayIds = new Set(existing.map((l) => l.linkedStayId).filter(Boolean));
  const linkedLegIds = new Set(existing.map((l) => l.linkedTransportLegId).filter(Boolean));
  const linkedActivityIds = new Set(existing.map((l) => l.linkedActivityId).filter(Boolean));

  return seeds.filter((seed) => {
    if (seed.linkedStayId) {
      if (linkedStayIds.has(seed.linkedStayId)) return false;
      if (dismissedKeys.has(`accommodation_stay:${seed.linkedStayId}`)) return false;
    }
    if (seed.linkedTransportLegId) {
      if (linkedLegIds.has(seed.linkedTransportLegId)) return false;
      if (dismissedKeys.has(`transport_leg:${seed.linkedTransportLegId}`)) return false;
    }
    if (seed.linkedActivityId) {
      if (linkedActivityIds.has(seed.linkedActivityId)) return false;
      if (dismissedKeys.has(`itinerary_item:${seed.linkedActivityId}`)) return false;
    }
    return true;
  });
}
