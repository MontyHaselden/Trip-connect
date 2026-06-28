import type { TripEntityGraph } from "../types";
import { normalizeGraphActivities } from "../merge-graph-activities";
import { transportLegFinanceDescription } from "../transport-route-label";

import { countStayNights } from "./accommodation-nights";
import { financeSeedAccommodationStays } from "./accommodation-finance-leg";
import {
  buildTransportProductSeeds,
  financeSeedTransportLegs,
} from "./transport-finance-product";
import {
  activityFinanceContentKey,
  financeSeedContentKey,
} from "./finance-line-dedupe";
import { defaultCostLineFinanceFields } from "./finance-metadata";
import type { CostLineItemDraft } from "./types";

function seedStay(stay: TripEntityGraph["accommodationStays"][number], sortOrder: number) {
  if (!stay.name?.trim()) return null;
  return {
    sortOrder,
    category: "accommodation" as const,
    description: `${stay.name!.trim()} (${stay.cityLabel})`,
    notes: `${stay.checkInDate} → ${stay.checkOutDate}`,
    totalAmountCents: 0,
    currency: "NZD",
    quantity: countStayNights(stay.checkInDate, stay.checkOutDate) || null,
    allocationRuleType: "equal_present" as const,
    allocationRulePayload: {},
    linkedStayId: stay.id,
    linkedTransportLegId: null,
    linkedTransportProductId: null,
    linkedActivityId: null,
    scope: "presence" as const,
    supplierPaymentStatus: null,
    ...defaultCostLineFinanceFields(),
  };
}

function seedLeg(
  leg: TripEntityGraph["outboundLegs"][number] | TripEntityGraph["intercityLegs"][number],
  graph: TripEntityGraph,
  sortOrder: number,
) {
  return {
    sortOrder,
    category: "transport" as const,
    description: transportLegFinanceDescription(leg, graph),
    notes: null,
    totalAmountCents: 0,
    currency: "NZD",
    quantity: null,
    allocationRuleType: "equal_present" as const,
    allocationRulePayload: {},
    linkedStayId: null,
    linkedTransportLegId: leg.id,
    linkedTransportProductId: null,
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
    linkedTransportProductId: null,
    linkedActivityId: activity.id,
    scope: "presence" as const,
    supplierPaymentStatus: null,
    ...defaultCostLineFinanceFields(),
  };
}

export function buildSeedLineItems(graph: TripEntityGraph): Omit<CostLineItemDraft, "id">[] {
  const items: Omit<CostLineItemDraft, "id">[] = [];
  let sortOrder = 0;

  for (const stay of financeSeedAccommodationStays(graph)) {
    const seed = seedStay(stay, sortOrder++);
    if (seed) items.push(seed);
  }

  for (const productSeed of buildTransportProductSeeds(graph, sortOrder)) {
    items.push(productSeed);
    sortOrder += 1;
  }

  for (const leg of financeSeedTransportLegs(graph)) {
    items.push(seedLeg(leg, graph, sortOrder++));
  }

  for (const activity of normalizeGraphActivities(graph.activities)) {
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
  const existingActivityContentKeys = new Set(
    existing.flatMap((line) => {
      const key = activityFinanceContentKey(line);
      return key ? [key] : [];
    }),
  );
  const existingStayContentKeys = new Set(
    existing.flatMap((line) => {
      const key = financeSeedContentKey(line);
      return key?.startsWith("accommodation:") ? [key] : [];
    }),
  );
  const existingTransportContentKeys = new Set(
    existing.flatMap((line) => {
      const key = financeSeedContentKey(line);
      return key?.startsWith("transport:") ? [key] : [];
    }),
  );

  const linkedProductIds = new Set(
    existing.map((l) => l.linkedTransportProductId).filter(Boolean),
  );

  return seeds.filter((seed) => {
    if (seed.linkedStayId) {
      if (linkedStayIds.has(seed.linkedStayId)) return false;
      if (dismissedKeys.has(`accommodation_stay:${seed.linkedStayId}`)) return false;
    }
    if (seed.linkedTransportProductId) {
      if (linkedProductIds.has(seed.linkedTransportProductId)) return false;
      if (dismissedKeys.has(`transport_product:${seed.linkedTransportProductId}`)) return false;
    }
    if (seed.linkedTransportLegId) {
      if (linkedLegIds.has(seed.linkedTransportLegId)) return false;
      if (dismissedKeys.has(`transport_leg:${seed.linkedTransportLegId}`)) return false;
    }
    if (seed.linkedActivityId) {
      if (linkedActivityIds.has(seed.linkedActivityId)) return false;
      if (dismissedKeys.has(`itinerary_item:${seed.linkedActivityId}`)) return false;
    }
    if (seed.category === "activities") {
      const contentKey = activityFinanceContentKey(seed);
      if (contentKey && existingActivityContentKeys.has(contentKey)) return false;
    }
    if (seed.category === "accommodation") {
      const contentKey = financeSeedContentKey(seed);
      if (contentKey && existingStayContentKeys.has(contentKey)) return false;
    }
    if (seed.category === "transport" || seed.category === "flights") {
      const contentKey = financeSeedContentKey(seed);
      if (contentKey && existingTransportContentKeys.has(contentKey)) return false;
    }
    return true;
  });
}
