import { legsForTransportProduct } from "@/lib/host/locations/transport-products";
import { classifyFlightLeg } from "@/lib/host/setup/classify-flight-legs";
import { dedupeCityChangeLegs } from "@/lib/host/setup/dedupe-intercity-legs";
import { mainAccommodationStays } from "@/lib/host/setup/entity-scope";
import { inferLegArrivalDate } from "@/lib/host/setup/repair-transport-legs";
import { locationsMatch } from "@/lib/host/wizard/location-stays";
import type {
  IntercityLegDraft,
  TransportLegDraft,
  TransportProductDraft,
  TransportProductKind,
} from "@/lib/host/wizard/types";

import { isReverseFlightPair } from "./flight-package-pairs";
import { graphToSetupState } from "./adapters";
import type { TripEntityGraph } from "./types";

type TransportLeg = TransportLegDraft | IntercityLegDraft;

function normalizeProductName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

function productKey(product: Pick<TransportProductDraft, "kind" | "name">): string {
  return `${product.kind}:${normalizeProductName(product.name)}`;
}

function countLinkedLegs(
  graph: Pick<
    TripEntityGraph,
    "outboundLegs" | "returnLegs" | "intercityLegs"
  >,
  productId: string,
): number {
  return legsForTransportProduct(graph, productId).length;
}

function mapLegs<T extends TransportLeg>(
  legs: T[],
  remap: (leg: T) => T,
): T[] {
  let changed = false;
  const next = legs.map((leg) => {
    const mapped = remap(leg);
    if (mapped !== leg) changed = true;
    return mapped;
  });
  return changed ? next : legs;
}

function repairLegDates<T extends TransportLeg>(leg: T): T {
  const travelDate = leg.travelDate?.trim() ?? "";
  const arrival = leg.arrivalDate?.trim() ?? "";
  if (travelDate && arrival && arrival < travelDate) {
    return {
      ...leg,
      travelDate: arrival,
      arrivalDate: travelDate,
    };
  }
  const inferred = inferLegArrivalDate(leg as TransportLegDraft);
  return inferred === leg ? leg : ({ ...inferred } as T);
}

function productKindMatchesLeg(
  kind: TransportProductKind,
  leg: TransportLeg,
  bucket: "outbound" | "return" | "intercity",
): boolean {
  if (kind === "flight_package") {
    return leg.transportType === "plane" && bucket !== "intercity";
  }
  if (kind === "train_pass") {
    return bucket === "intercity" && leg.transportType !== "plane";
  }
  return true;
}

function unlinkMisassignedLegs<T extends TransportLeg>(
  legs: T[],
  bucket: "outbound" | "return" | "intercity",
  products: TransportProductDraft[],
): T[] {
  return mapLegs(legs, (leg) => {
    const productId = leg.transportProductId?.trim();
    if (!productId) return leg;
    const product = products.find((row) => row.id === productId);
    if (!product || !productKindMatchesLeg(product.kind, leg, bucket)) {
      return { ...leg, transportProductId: null };
    }
    return leg;
  });
}

function dedupeTransportProducts(
  graph: Pick<
    TripEntityGraph,
    "transportProducts" | "outboundLegs" | "returnLegs" | "intercityLegs"
  >,
): {
  products: TransportProductDraft[];
  remap: Map<string, string>;
} {
  const products = graph.transportProducts ?? [];
  if (products.length <= 1) {
    return { products, remap: new Map() };
  }

  const groups = new Map<string, TransportProductDraft[]>();
  for (const product of products) {
    const key = productKey(product);
    const bucket = groups.get(key) ?? [];
    bucket.push(product);
    groups.set(key, bucket);
  }

  const remap = new Map<string, string>();
  const keepers: TransportProductDraft[] = [];

  for (const group of groups.values()) {
    if (group.length === 1) {
      keepers.push(group[0]!);
      continue;
    }
    const sorted = [...group].sort((a, b) => {
      const byLegs = countLinkedLegs(graph, b.id) - countLinkedLegs(graph, a.id);
      if (byLegs !== 0) return byLegs;
      return a.id.localeCompare(b.id);
    });
    const keeper = sorted[0]!;
    keepers.push(keeper);
    for (const duplicate of sorted.slice(1)) {
      remap.set(duplicate.id, keeper.id);
    }
  }

  keepers.sort((a, b) => a.id.localeCompare(b.id));
  return { products: keepers, remap };
}

function remapLegProductIds<T extends TransportLeg>(
  legs: T[],
  remap: Map<string, string>,
): T[] {
  if (!remap.size) return legs;
  return mapLegs(legs, (leg) => {
    const productId = leg.transportProductId?.trim();
    if (!productId) return leg;
    const nextId = remap.get(productId);
    if (!nextId || nextId === productId) return leg;
    return { ...leg, transportProductId: nextId };
  });
}

function linkOrphanFlightPackages(
  graph: Pick<
    TripEntityGraph,
    "mainGroupId" | "transportProducts" | "outboundLegs" | "returnLegs"
  >,
): {
  outboundLegs: TransportLegDraft[];
  returnLegs: TransportLegDraft[];
} {
  const products = (graph.transportProducts ?? []).filter(
    (product) => product.kind === "flight_package",
  );
  if (!products.length) {
    return { outboundLegs: graph.outboundLegs, returnLegs: graph.returnLegs };
  }

  let outboundLegs = graph.outboundLegs;
  let returnLegs = graph.returnLegs;

  for (const product of products) {
    const alreadyLinked =
      outboundLegs.some((leg) => leg.transportProductId === product.id) ||
      returnLegs.some((leg) => leg.transportProductId === product.id);
    if (alreadyLinked) continue;

    const unlinkedOutbound = outboundLegs.filter(
      (leg) =>
        leg.transportType === "plane" &&
        !leg.transportProductId &&
        (!leg.originGroupId || leg.originGroupId === graph.mainGroupId),
    );
    const unlinkedReturn = returnLegs.filter(
      (leg) =>
        leg.transportType === "plane" &&
        !leg.transportProductId &&
        (!leg.originGroupId || leg.originGroupId === graph.mainGroupId),
    );

    let matched = false;
    for (const outbound of unlinkedOutbound) {
      const pairedReturn = unlinkedReturn.find((leg) =>
        isReverseFlightPair(outbound, leg),
      );
      if (!pairedReturn) continue;
      outboundLegs = outboundLegs.map((leg) =>
        leg.id === outbound.id ? { ...leg, transportProductId: product.id } : leg,
      );
      returnLegs = returnLegs.map((leg) =>
        leg.id === pairedReturn.id ? { ...leg, transportProductId: product.id } : leg,
      );
      matched = true;
      break;
    }
    if (matched) continue;
  }

  return { outboundLegs, returnLegs };
}

/** Move flight-package legs into outbound vs return when both were dumped into one bucket. */
function rebucketFlightPackageLegs(
  graph: TripEntityGraph,
  outboundLegs: TransportLegDraft[],
  returnLegs: TransportLegDraft[],
): { outboundLegs: TransportLegDraft[]; returnLegs: TransportLegDraft[] } {
  const flightPackages = new Set(
    (graph.transportProducts ?? [])
      .filter((product) => product.kind === "flight_package")
      .map((product) => product.id),
  );
  if (!flightPackages.size) {
    return { outboundLegs, returnLegs };
  }

  const state = graphToSetupState({
    ...graph,
    outboundLegs,
    returnLegs,
  });

  let outbound = [...outboundLegs];
  let returns = [...returnLegs];
  const moveToReturn: TransportLegDraft[] = [];

  outbound = outbound.filter((leg) => {
    if (leg.transportType !== "plane") return true;
    if (!leg.transportProductId || !flightPackages.has(leg.transportProductId)) {
      return true;
    }
    if (classifyFlightLeg(leg, state) !== "return") return true;
    moveToReturn.push(leg);
    return false;
  });

  if (!moveToReturn.length) {
    return { outboundLegs, returnLegs };
  }

  returns = [...returns, ...moveToReturn];
  return { outboundLegs: outbound, returnLegs: returns };
}

function intercityLegRouteKey(leg: IntercityLegDraft): string {
  const from = (leg.intercityFromCity || leg.fromCity).trim();
  const to = (leg.intercityToCity || leg.toCity).trim();
  return [
    leg.travelDate?.trim() ?? "",
    from.toLowerCase(),
    to.toLowerCase(),
    leg.transportProductId?.trim() ?? "",
    leg.originGroupId?.trim() ?? "",
  ].join("|");
}

function dedupePersonalIntercityLegs(legs: IntercityLegDraft[]): IntercityLegDraft[] {
  const kept = new Map<string, IntercityLegDraft>();
  const passthrough: IntercityLegDraft[] = [];

  for (const leg of legs) {
    const isCityChange = leg.legKind === "city_change" || !leg.legKind;
    if (!isCityChange) {
      passthrough.push(leg);
      continue;
    }
    const key = intercityLegRouteKey(leg);
    const existing = kept.get(key);
    if (!existing) {
      kept.set(key, leg);
      continue;
    }
    const keeper =
      existing.transportProductId && !leg.transportProductId
        ? existing
        : leg.transportProductId && !existing.transportProductId
          ? leg
          : existing.id.localeCompare(leg.id) <= 0
            ? existing
            : leg;
    kept.set(key, keeper);
  }

  return [...passthrough, ...kept.values()];
}

function dedupeIntercityLegsForGraph(graph: TripEntityGraph): IntercityLegDraft[] {
  const mainGroupId = graph.mainGroupId;
  const mainDays = graph.dayPlacesByGroupId[mainGroupId] ?? [];
  const mainStays = mainAccommodationStays(graph);
  const mainScoped: IntercityLegDraft[] = [];
  const personalScoped: IntercityLegDraft[] = [];

  for (const leg of graph.intercityLegs) {
    if (!leg.originGroupId || leg.originGroupId === mainGroupId) {
      mainScoped.push(leg);
    } else {
      personalScoped.push(leg);
    }
  }

  return [
    ...dedupeCityChangeLegs(mainScoped, mainStays, mainDays),
    ...dedupePersonalIntercityLegs(personalScoped),
  ];
}

function matchingIntercityLeg(
  graph: TripEntityGraph,
  leg: IntercityLegDraft,
  groupId: string,
): IntercityLegDraft | undefined {
  const from = (leg.intercityFromCity || leg.fromCity).trim();
  const to = (leg.intercityToCity || leg.toCity).trim();
  const date = leg.travelDate?.trim() ?? "";
  const scope = leg.originGroupId ?? groupId;

  return graph.intercityLegs.find((existing) => {
    const existingScope = existing.originGroupId ?? graph.mainGroupId;
    if (existingScope !== scope) return false;
    const existingFrom = (existing.intercityFromCity || existing.fromCity).trim();
    const existingTo = (existing.intercityToCity || existing.toCity).trim();
    return (
      (existing.travelDate?.trim() ?? "") === date &&
      locationsMatch(existingFrom, from) &&
      locationsMatch(existingTo, to)
    );
  });
}

/** Apply a duplicate intercity add by merging product links, or signal append when new. */
export function mergeDuplicateIntercityLegAdd(
  graph: TripEntityGraph,
  leg: IntercityLegDraft,
  groupId: string,
): TripEntityGraph | null {
  const existing = matchingIntercityLeg(graph, leg, groupId);
  if (!existing) return null;

  if (!existing.transportProductId && leg.transportProductId) {
    return {
      ...graph,
      intercityLegs: graph.intercityLegs.map((row) =>
        row.id === existing.id ? { ...row, transportProductId: leg.transportProductId } : row,
      ),
    };
  }

  return graph;
}

/** Normalize transport products and legs after load or before display. */
export function repairTransportGraphSync<T extends TripEntityGraph>(graph: T): T {
  const products = graph.transportProducts ?? [];
  let outboundLegs = graph.outboundLegs.map(repairLegDates);
  let returnLegs = graph.returnLegs.map(repairLegDates);
  let intercityLegs = graph.intercityLegs.map(repairLegDates);

  outboundLegs = unlinkMisassignedLegs(outboundLegs, "outbound", products);
  returnLegs = unlinkMisassignedLegs(returnLegs, "return", products);
  intercityLegs = unlinkMisassignedLegs(intercityLegs, "intercity", products);

  const deduped = dedupeTransportProducts({
    transportProducts: products,
    outboundLegs,
    returnLegs,
    intercityLegs,
  });

  outboundLegs = remapLegProductIds(outboundLegs, deduped.remap);
  returnLegs = remapLegProductIds(returnLegs, deduped.remap);
  intercityLegs = remapLegProductIds(intercityLegs, deduped.remap);

  const dedupedIntercity = dedupeIntercityLegsForGraph({
    ...graph,
    transportProducts: deduped.products,
    outboundLegs,
    returnLegs,
    intercityLegs,
  });
  intercityLegs = dedupedIntercity;

  const linked = linkOrphanFlightPackages({
    mainGroupId: graph.mainGroupId,
    transportProducts: deduped.products,
    outboundLegs,
    returnLegs,
  });

  const rebucketed = rebucketFlightPackageLegs(
    { ...graph, transportProducts: deduped.products },
    linked.outboundLegs,
    linked.returnLegs,
  );

  const intercityIdsBefore = graph.intercityLegs.map((leg) => leg.id).sort().join("|");
  const intercityIdsAfter = intercityLegs.map((leg) => leg.id).sort().join("|");

  const changed =
    rebucketed.outboundLegs !== graph.outboundLegs ||
    rebucketed.returnLegs !== graph.returnLegs ||
    linked.outboundLegs !== graph.outboundLegs ||
    linked.returnLegs !== graph.returnLegs ||
    outboundLegs !== graph.outboundLegs ||
    returnLegs !== graph.returnLegs ||
    intercityLegs !== graph.intercityLegs ||
    intercityIdsBefore !== intercityIdsAfter ||
    deduped.products !== products;

  if (!changed) return graph;

  return {
    ...graph,
    transportProducts: deduped.products,
    outboundLegs: rebucketed.outboundLegs,
    returnLegs: rebucketed.returnLegs,
    intercityLegs,
  };
}
