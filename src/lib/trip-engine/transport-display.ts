import { findTransportProduct } from "@/lib/host/locations/transport-products";
import type { IntercityLegDraft, TransportLegDraft, TransportProductDraft } from "@/lib/host/wizard/types";

import {
  transportLegRouteLabel as formatTransportLegRouteLabel,
} from "./transport-route-label";
import type { TripEntityGraph } from "./types";

export {
  financeLineDisplayDescription,
  formatTransportPlace,
  transportLegFinanceDescription,
  transportRouteLabel,
} from "./transport-route-label";

export function compareTransportLegsChronologically(
  a: TransportLegDraft,
  b: TransportLegDraft,
): number {
  const dateCmp = (a.travelDate?.trim() ?? "").localeCompare(b.travelDate?.trim() ?? "");
  if (dateCmp !== 0) return dateCmp;
  return (a.departureTime?.trim() ?? "").localeCompare(b.departureTime?.trim() ?? "");
}

export function transportLegRouteLabel(
  leg: TransportLegDraft | IntercityLegDraft,
  graph?: TripEntityGraph | null,
): string {
  return formatTransportLegRouteLabel(leg, graph);
}

export function transportItineraryTitle(
  leg: TransportLegDraft,
  products: TransportProductDraft[] = [],
  graph?: TripEntityGraph | null,
): string {
  const product = findTransportProduct(products, leg.transportProductId);
  const route = transportLegRouteLabel(leg, graph);
  if (product) {
    if (product.kind === "flight_package" && leg.transportType === "plane" && leg.flightNumber) {
      return `${product.name} - Flight ${leg.flightNumber}: ${route}`;
    }
    return `${product.name} - ${route}`;
  }
  const type = leg.transportType.charAt(0).toUpperCase() + leg.transportType.slice(1);
  if (leg.transportType === "plane" && leg.flightNumber) {
    return `Flight ${leg.flightNumber}: ${route}`;
  }
  return `${type}: ${route}`;
}
