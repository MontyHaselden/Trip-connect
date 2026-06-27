import type { TripEntityGraph } from "../types";
import { legsForTransportProduct } from "@/lib/host/locations/transport-products";
import { transportLegRouteLabel } from "../transport-route-label";
import { transportLegDisplayKey } from "../group-transport-legs-for-display";
import type { TransportProductDraft } from "@/lib/host/wizard/types";

import type { CostLineItemDraft } from "./types";
import { defaultCostLineFinanceFields } from "./finance-metadata";

export function allTransportLegs(
  graph: TripEntityGraph,
): Array<TripEntityGraph["outboundLegs"][number]> {
  return [...graph.outboundLegs, ...graph.returnLegs, ...graph.intercityLegs];
}

export function productLegRoutesSummary(
  graph: TripEntityGraph,
  productId: string,
): string {
  const legIds = legsForTransportProduct(graph, productId);
  const legs = allTransportLegs(graph)
    .filter((leg) => legIds.includes(leg.id))
    .sort((a, b) => a.travelDate.localeCompare(b.travelDate));
  if (!legs.length) return "";
  return legs
    .map((leg) => transportLegRouteLabel(leg, graph))
    .join(" · ");
}

function seedProduct(
  product: TransportProductDraft,
  graph: TripEntityGraph,
  sortOrder: number,
): Omit<CostLineItemDraft, "id"> {
  return {
    sortOrder,
    category: "transport",
    description: product.name.trim() || "Transport product",
    notes: productLegRoutesSummary(graph, product.id) || product.notes?.trim() || null,
    totalAmountCents: 0,
    currency: "NZD",
    quantity: null,
    allocationRuleType: "equal_present",
    allocationRulePayload: {},
    linkedStayId: null,
    linkedTransportLegId: null,
    linkedTransportProductId: product.id,
    linkedActivityId: null,
    scope: "presence",
    supplierPaymentStatus: null,
    ...defaultCostLineFinanceFields(),
  };
}

export function financeSeedTransportProducts(
  graph: TripEntityGraph,
): TransportProductDraft[] {
  return graph.transportProducts ?? [];
}

export function financeSeedTransportLegs(
  graph: TripEntityGraph,
): Array<TripEntityGraph["outboundLegs"][number]> {
  const legs = allTransportLegs(graph).filter((leg) => !leg.transportProductId);
  const mainGroupId = graph.mainGroupId;
  const kept: typeof legs = [];
  const personalByKey = new Map<string, typeof legs>();

  for (const leg of legs) {
    const origin = leg.originGroupId ?? mainGroupId;
    if (origin === mainGroupId) {
      kept.push(leg);
      continue;
    }
    const key = transportLegDisplayKey(leg);
    const bucket = personalByKey.get(key) ?? [];
    bucket.push(leg);
    personalByKey.set(key, bucket);
  }

  for (const bucket of personalByKey.values()) {
    kept.push(bucket[0]!);
  }

  return kept;
}

export function buildTransportProductSeeds(
  graph: TripEntityGraph,
  sortOrderStart: number,
): Omit<CostLineItemDraft, "id">[] {
  return financeSeedTransportProducts(graph).map((product, index) =>
    seedProduct(product, graph, sortOrderStart + index),
  );
}

export function findTransportProductOnGraph(
  graph: TripEntityGraph,
  productId: string,
): TransportProductDraft | null {
  return graph.transportProducts?.find((product) => product.id === productId) ?? null;
}
