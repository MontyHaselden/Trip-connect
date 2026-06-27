import { placesShareMetro } from "@/lib/geo/airport-codes";
import { addDays, locationPaletteKey, locationsMatch } from "@/lib/host/wizard/location-stays";
import type { TransportLegDraft } from "@/lib/host/wizard/types";
import type { TransportProductDraft } from "@/lib/host/wizard/types";
import { legsForTransportProduct } from "@/lib/host/locations/transport-products";

import { transportLegDisplayKey } from "../group-transport-legs-for-display";
import { allTransportLegs } from "./transport-finance-product";

import { costSplitParticipants } from "./allocate";
import {
  citiesForParticipantOnDate,
  resolveAllParticipantPlans,
  type ResolvedParticipantPlan,
} from "../resolve-participant-graph";
import type { RosterSummary, TripEntityGraph } from "../types";
import { participantSharesMainContextOnDate } from "../match-main-accommodation-stay";
import { personalGroupForParticipant } from "../person-lens";
import { isSameFinanceAccommodationLeg } from "./accommodation-finance-leg";
import type { CostLineItemDraft } from "./types";

export type ParticipantPresenceMap = Map<string, ResolvedParticipantPlan>;

export function buildParticipantPresenceMap(
  graph: TripEntityGraph,
  roster: RosterSummary,
): ParticipantPresenceMap {
  return resolveAllParticipantPlans(graph, roster);
}

function dateInRange(date: string, start: string, end: string): boolean {
  return date >= start && date <= end;
}

export function participantEligibleForStay(
  plan: ResolvedParticipantPlan,
  stay: {
    id: string;
    cityLabel: string;
    checkInDate: string;
    checkOutDate: string;
    name?: string | null;
  },
  graph?: TripEntityGraph,
): boolean {
  if (plan.stayIds.has(stay.id)) return true;
  if (graph) {
    for (const personalStay of graph.accommodationStays) {
      if (!plan.stayIds.has(personalStay.id)) continue;
      if (personalStay.id === stay.id) return true;
      if (isSameFinanceAccommodationLeg(personalStay, stay)) return true;
    }
  }
  const stayCity = locationPaletteKey(stay.cityLabel);
  if (!stayCity) return false;
  for (const [date] of plan.daysByDate) {
    if (!dateInRange(date, stay.checkInDate, stay.checkOutDate)) continue;
    if (citiesForParticipantOnDate(plan, date).includes(stayCity)) return true;
  }
  return false;
}

function stayEligible(
  plan: ResolvedParticipantPlan,
  stay: {
    id: string;
    cityLabel: string;
    checkInDate: string;
    checkOutDate: string;
    name?: string | null;
  },
  graph: TripEntityGraph,
): boolean {
  return participantEligibleForStay(plan, stay, graph);
}

function activityEligible(
  plan: ResolvedParticipantPlan,
  activity: TripEntityGraph["activities"][number],
  graph?: TripEntityGraph,
): boolean {
  if (!plan.activityIds.has(activity.id)) return false;
  const end = activity.endDate?.trim() || activity.date;
  for (const [date] of plan.daysByDate) {
    if (date >= activity.date && date <= end) return true;
  }
  if (graph && plan.mode === "independent") {
    const personal = personalGroupForParticipant(graph, plan.participantId);
    if (personal) {
      let cur = activity.date;
      while (cur <= end) {
        if (participantSharesMainContextOnDate(graph, personal.id, cur)) return true;
        cur = addDays(cur, 1);
      }
    }
  }
  return activity.date <= (plan.daysByDate.size ? [...plan.daysByDate.keys()].sort().at(-1)! : activity.date);
}

function findTransportLeg(graph: TripEntityGraph, legId: string) {
  return [...graph.outboundLegs, ...graph.returnLegs, ...graph.intercityLegs].find(
    (leg) => leg.id === legId,
  );
}

/** Collapsed personal legs share one finance row — check every sibling id for presence. */
export function transportLegIdsForFinancePresence(
  graph: TripEntityGraph,
  legId: string,
): string[] {
  const leg = findTransportLeg(graph, legId);
  if (!leg) return [legId];
  const origin = leg.originGroupId ?? graph.mainGroupId;
  if (origin === graph.mainGroupId) return [legId];
  const key = transportLegDisplayKey(leg);
  return allTransportLegs(graph)
    .filter((row) => (row.originGroupId ?? graph.mainGroupId) !== graph.mainGroupId)
    .filter((row) => transportLegDisplayKey(row) === key)
    .map((row) => row.id);
}

function transportLegEndpoints(leg: {
  fromCity: string;
  toCity: string;
  intercityFromCity?: string;
  intercityToCity?: string;
}): { fromKey: string; toKey: string; fromRaw: string; toRaw: string } {
  const fromRaw =
    ("intercityFromCity" in leg && leg.intercityFromCity?.trim()) || leg.fromCity?.trim() || "";
  const toRaw =
    ("intercityToCity" in leg && leg.intercityToCity?.trim()) || leg.toCity?.trim() || "";
  return {
    fromRaw,
    toRaw,
    fromKey: locationPaletteKey(fromRaw),
    toKey: locationPaletteKey(toRaw),
  };
}

function cityMatchesPlace(city: string, placeKey: string, placeRaw: string): boolean {
  const trimmed = city.trim();
  if (!trimmed) return false;
  return (
    locationsMatch(trimmed, placeRaw) ||
    locationsMatch(locationPaletteKey(trimmed), placeKey) ||
    placesShareMetro(trimmed, placeRaw)
  );
}

function participantAtPlaceOnDate(
  plan: ResolvedParticipantPlan,
  date: string,
  placeKey: string,
  placeRaw: string,
): boolean {
  return citiesForParticipantOnDate(plan, date).some((city) =>
    cityMatchesPlace(city, placeKey, placeRaw),
  );
}

/** Left half of a travel split day matches the leg origin — same flight, personal destination may differ. */
function participantDepartsFromOnTravelDate(
  plan: ResolvedParticipantPlan,
  travelDate: string,
  fromKey: string,
  fromRaw: string,
): boolean {
  const day = plan.daysByDate.get(travelDate);
  if (!day?.secondaryCity?.trim() || !day.primaryCity.trim()) return false;
  return cityMatchesPlace(day.primaryCity, fromKey, fromRaw);
}

function participantArrivesAtOnDate(
  plan: ResolvedParticipantPlan,
  date: string,
  toKey: string,
  toRaw: string,
): boolean {
  const day = plan.daysByDate.get(date);
  if (!day) return false;
  if (day.secondaryCity?.trim()) {
    return cityMatchesPlace(day.secondaryCity, toKey, toRaw);
  }
  return cityMatchesPlace(day.primaryCity, toKey, toRaw);
}

function mainGroupDepartsOnTravelDate(
  graph: TripEntityGraph,
  travelDate: string,
  fromKey: string,
  fromRaw: string,
): boolean {
  const mainDay = graph.dayPlacesByGroupId[graph.mainGroupId]?.find((d) => d.date === travelDate);
  if (!mainDay?.secondaryCity?.trim() || !mainDay.primaryCity.trim()) return false;
  return cityMatchesPlace(mainDay.primaryCity, fromKey, fromRaw);
}

/** True when a participant's calendar follows this transport leg. */
export function participantUsesTransportLeg(
  plan: ResolvedParticipantPlan,
  leg: Pick<
    TransportLegDraft,
    "id" | "travelDate" | "arrivalDate" | "fromCity" | "toCity" | "surfaceOnly"
  > & {
    intercityFromCity?: string;
    intercityToCity?: string;
  },
  graph?: TripEntityGraph,
): boolean {
  if (leg.surfaceOnly) return false;

  const legOrigin = (leg as { originGroupId?: string | null }).originGroupId?.trim();
  if (graph && legOrigin && legOrigin !== graph.mainGroupId) {
    return plan.legIds.has(leg.id);
  }

  const travelDate = leg.travelDate?.trim();
  if (!travelDate) return plan.legIds.has(leg.id);

  const { fromKey, toKey, fromRaw, toRaw } = transportLegEndpoints(leg);
  if (!fromKey || !toKey) return plan.legIds.has(leg.id);

  const dayCities = citiesForParticipantOnDate(plan, travelDate);
  const hasFrom = dayCities.some((city) => cityMatchesPlace(city, fromKey, fromRaw));
  const hasTo = dayCities.some((city) => cityMatchesPlace(city, toKey, toRaw));

  if (hasFrom && hasTo) return true;

  const arrivalDate = leg.arrivalDate?.trim() || travelDate;
  const arrivesAtDestination = citiesForParticipantOnDate(plan, arrivalDate).some((city) =>
    cityMatchesPlace(city, toKey, toRaw),
  );

  if (hasFrom && arrivesAtDestination) return true;

  if (
    participantDepartsFromOnTravelDate(plan, travelDate, fromKey, fromRaw) &&
    (arrivesAtDestination ||
      citiesForParticipantOnDate(plan, travelDate).some((city) =>
        cityMatchesPlace(city, toKey, toRaw),
      ))
  ) {
    return true;
  }

  if (graph && plan.mode === "overlay" && mainGroupDepartsOnTravelDate(graph, travelDate, fromKey, fromRaw)) {
    for (const date of [travelDate, arrivalDate, addDays(travelDate, 1)]) {
      if (participantArrivesAtOnDate(plan, date, toKey, toRaw)) return true;
    }
    if (participantAtPlaceOnDate(plan, travelDate, fromKey, fromRaw)) return true;
  }

  if (hasTo && !hasFrom) return true;

  return false;
}

function legEligible(
  plan: ResolvedParticipantPlan,
  graph: TripEntityGraph,
  legId: string,
): boolean {
  const leg = findTransportLeg(graph, legId);
  if (!leg) return false;
  return participantUsesTransportLeg(plan, leg, graph);
}

function transportProductEligible(
  plan: ResolvedParticipantPlan,
  graph: TripEntityGraph,
  product: TransportProductDraft,
): boolean {
  if (product.kind === "flight_package") {
    const legIds = legsForTransportProduct(graph, product.id);
    if (!legIds.length) return false;
    return legIds.every((legId) => legEligible(plan, graph, legId));
  }
  return product.participantIds.includes(plan.participantId);
}

export function eligibleParticipantIdsForLine(
  line: CostLineItemDraft,
  graph: TripEntityGraph,
  roster: RosterSummary,
  presence: ParticipantPresenceMap,
): string[] {
  const pool = costSplitParticipants(roster);

  if (line.scope === "trip_wide" || line.allocationRuleType === "equal_cost_participants") {
    if (
      !line.linkedStayId &&
      !line.linkedTransportLegId &&
      !line.linkedTransportProductId &&
      !line.linkedActivityId
    ) {
      return pool.map((p) => p.id);
    }
  }

  if (line.allocationRuleType === "assign_one") {
    const id = line.allocationRulePayload.participantId?.trim();
    return id ? [id] : [];
  }

  if (line.allocationRuleType === "equal_group") {
    const groupId = line.allocationRulePayload.groupId?.trim();
    if (!groupId) return [];
    return pool.filter((p) => p.groupIds.includes(groupId)).map((p) => p.id);
  }

  if (line.linkedStayId) {
    const stay = graph.accommodationStays.find((s) => s.id === line.linkedStayId);
    if (!stay) return [];
    return pool
      .filter((p) => {
        const plan = presence.get(p.id);
        return plan ? stayEligible(plan, stay, graph) : false;
      })
      .map((p) => p.id);
  }

  if (line.linkedTransportProductId) {
    const product = (graph.transportProducts ?? []).find(
      (row) => row.id === line.linkedTransportProductId,
    );
    if (!product) return [];
    return pool
      .filter((participant) => {
        const plan = presence.get(participant.id);
        return plan ? transportProductEligible(plan, graph, product) : false;
      })
      .map((participant) => participant.id);
  }

  if (line.linkedTransportLegId) {
    const legIds = transportLegIdsForFinancePresence(graph, line.linkedTransportLegId);
    return pool
      .filter((p) => {
        const plan = presence.get(p.id);
        return plan ? legIds.some((legId) => legEligible(plan, graph, legId)) : false;
      })
      .map((p) => p.id);
  }

  if (line.linkedActivityId) {
    const activity = graph.activities.find((a) => a.id === line.linkedActivityId);
    if (!activity) return [];
    return pool
      .filter((p) => {
        const plan = presence.get(p.id);
        return plan ? activityEligible(plan, activity, graph) : false;
      })
      .map((p) => p.id);
  }

  return pool.map((p) => p.id);
}

export function presenceHintForLine(
  line: CostLineItemDraft,
  graph: TripEntityGraph,
  roster: RosterSummary,
  presence: ParticipantPresenceMap,
): string | null {
  const pool = costSplitParticipants(roster);
  if (!line.linkedStayId && !line.linkedActivityId && !line.linkedTransportLegId && !line.linkedTransportProductId) {
    return null;
  }
  const eligible = eligibleParticipantIdsForLine(line, graph, roster, presence);
  if (eligible.length === pool.length) return null;
  return `${eligible.length} of ${pool.length} on trip`;
}

export function lineDateSpanLabel(
  line: CostLineItemDraft,
  graph: TripEntityGraph,
): string | null {
  if (line.linkedStayId) {
    const stay = graph.accommodationStays.find((s) => s.id === line.linkedStayId);
    if (!stay) return null;
    return `${stay.checkInDate}–${stay.checkOutDate}${stay.cityLabel ? ` · ${stay.cityLabel}` : ""}`;
  }
  if (line.linkedActivityId) {
    const activity = graph.activities.find((a) => a.id === line.linkedActivityId);
    if (!activity) return null;
    return activity.date;
  }
  if (line.linkedTransportProductId) {
    const product = (graph.transportProducts ?? []).find(
      (row) => row.id === line.linkedTransportProductId,
    );
    if (!product) return null;
    const routeCount = legsForTransportProduct(graph, line.linkedTransportProductId).length;
    return routeCount
      ? `${product.name} · ${routeCount} leg${routeCount === 1 ? "" : "s"}`
      : product.name;
  }
  if (line.linkedTransportLegId) {
    const leg = [
      ...graph.outboundLegs,
      ...graph.returnLegs,
      ...graph.intercityLegs,
    ].find((l) => l.id === line.linkedTransportLegId);
    if (!leg) return null;
    return String(leg.travelDate ?? "");
  }
  return line.notes;
}
