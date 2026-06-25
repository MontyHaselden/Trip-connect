import { shortCityName } from "@/lib/host/setup/location-range-display";
import type { IntercityLegDraft, TransportLegDraft } from "@/lib/host/wizard/types";

import type { CostLineItemDraft } from "./cost-ledger/types";
import type { TripEntityGraph } from "./types";

export type TransportLabelContext = {
  homeCountry: string | null;
  destinationCountries: string[];
};

export function countryFromPlace(place: string): string | null {
  const trimmed = place.trim();
  const comma = trimmed.indexOf(",");
  if (comma < 0) return null;
  const country = trimmed.slice(comma + 1).trim();
  return country || null;
}

export function inferHomeCountry(
  departureCity: string | null | undefined,
  returnCity: string | null | undefined,
): string | null {
  for (const place of [departureCity, returnCity]) {
    const country = countryFromPlace(place?.trim() ?? "");
    if (country) return country;
  }
  return null;
}

export function transportLabelContextFromGraph(graph: TripEntityGraph): TransportLabelContext {
  return {
    homeCountry: inferHomeCountry(graph.basics.departureCity, graph.basics.returnCity),
    destinationCountries: (graph.basics.destinationCountries ?? []).filter(Boolean),
  };
}

export function transportLabelContextFromBasics(basics: {
  departureCity?: string | null;
  returnCity?: string | null;
  destinationCountries?: string[];
}): TransportLabelContext {
  return {
    homeCountry: inferHomeCountry(basics.departureCity, basics.returnCity),
    destinationCountries: (basics.destinationCountries ?? []).filter(Boolean),
  };
}

function countriesMatch(a: string, b: string): boolean {
  const left = a.trim().toLowerCase();
  const right = b.trim().toLowerCase();
  return left === right || left.includes(right) || right.includes(left);
}

/** City name only — drop country when trip is to one foreign country or place is home. */
export function formatTransportPlace(place: string, ctx: TransportLabelContext): string {
  const city = shortCityName(place);
  const country = countryFromPlace(place);
  if (!country) return city;

  if (ctx.destinationCountries.length === 1) {
    const destination = ctx.destinationCountries[0]!;
    if (countriesMatch(country, destination)) return city;
  }

  if (ctx.homeCountry && countriesMatch(country, ctx.homeCountry)) return city;

  return city;
}

export function legEndpoints(leg: TransportLegDraft | IntercityLegDraft): {
  from: string;
  to: string;
} {
  const ic = leg as IntercityLegDraft;
  return {
    from: ic.intercityFromCity?.trim() || leg.fromCity.trim(),
    to: ic.intercityToCity?.trim() || leg.toCity.trim(),
  };
}

export function allTransportLegsFromGraph(
  graph: TripEntityGraph,
): Array<TransportLegDraft | IntercityLegDraft> {
  return [...graph.outboundLegs, ...graph.returnLegs, ...graph.intercityLegs];
}

export function transportRouteKey(
  from: string,
  to: string,
  ctx: TransportLabelContext,
): string {
  const fromLabel = formatTransportPlace(from, ctx);
  const toLabel = formatTransportPlace(to, ctx);
  return `${fromLabel}→${toLabel}`.toLowerCase();
}

export function countLegsWithRouteKey(
  graph: TripEntityGraph,
  routeKey: string,
  ctx: TransportLabelContext,
): number {
  let count = 0;
  for (const leg of allTransportLegsFromGraph(graph)) {
    const { from, to } = legEndpoints(leg);
    if (transportRouteKey(from, to, ctx) === routeKey) count++;
  }
  return count;
}

export function shouldShowTransportDate(
  graph: TripEntityGraph,
  from: string,
  to: string,
  ctx: TransportLabelContext = transportLabelContextFromGraph(graph),
): boolean {
  const key = transportRouteKey(from, to, ctx);
  return countLegsWithRouteKey(graph, key, ctx) > 1;
}

export function transportRouteLabel(input: {
  from: string;
  to: string;
  date?: string | null;
  graph?: TripEntityGraph | null;
  ctx?: TransportLabelContext;
}): string {
  const ctx =
    input.ctx ??
    (input.graph ? transportLabelContextFromGraph(input.graph) : {
      homeCountry: null,
      destinationCountries: [],
    });
  const fromLabel = formatTransportPlace(input.from, ctx);
  const toLabel = formatTransportPlace(input.to, ctx);
  const route = `${fromLabel} → ${toLabel}`;

  if (!input.graph || !input.date?.trim()) return route;

  const { from, to } = input;
  if (!shouldShowTransportDate(input.graph, from, to, ctx)) return route;

  return `${input.date.trim()}: ${route}`;
}

export function transportLegRouteLabel(
  leg: TransportLegDraft | IntercityLegDraft,
  graph?: TripEntityGraph | null,
): string {
  const { from, to } = legEndpoints(leg);
  return transportRouteLabel({ from, to, date: leg.travelDate, graph });
}

export function transportLegFinanceDescription(
  leg: TransportLegDraft | IntercityLegDraft,
  graph: TripEntityGraph,
): string {
  return transportLegRouteLabel(leg, graph);
}

export function financeLineDisplayDescription(
  line: CostLineItemDraft,
  graph?: TripEntityGraph | null,
): string {
  if (!graph) return line.description;
  if (line.linkedTransportLegId) {
    const leg = allTransportLegsFromGraph(graph).find(
      (row) => row.id === line.linkedTransportLegId,
    );
    if (leg) return transportLegFinanceDescription(leg, graph);
  }
  return line.description;
}
