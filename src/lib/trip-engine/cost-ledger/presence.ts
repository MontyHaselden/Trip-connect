import { locationPaletteKey, locationsMatch } from "@/lib/host/wizard/location-stays";
import type { TransportLegDraft } from "@/lib/host/wizard/types";
import type { RosterSummary, TripEntityGraph } from "../types";

import { costSplitParticipants } from "./allocate";
import {
  citiesForParticipantOnDate,
  resolveAllParticipantPlans,
  type ResolvedParticipantPlan,
} from "../resolve-participant-graph";
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

function stayEligible(plan: ResolvedParticipantPlan, stay: {
  id: string;
  cityLabel: string;
  checkInDate: string;
  checkOutDate: string;
}): boolean {
  if (plan.stayIds.has(stay.id)) return true;
  const stayCity = locationPaletteKey(stay.cityLabel);
  if (!stayCity) return false;
  for (const [date, day] of plan.daysByDate) {
    if (!dateInRange(date, stay.checkInDate, stay.checkOutDate)) continue;
    if (citiesForParticipantOnDate(plan, date).includes(stayCity)) return true;
  }
  return false;
}

function activityEligible(
  plan: ResolvedParticipantPlan,
  activity: TripEntityGraph["activities"][number],
): boolean {
  if (!plan.activityIds.has(activity.id)) return false;
  const end = activity.endDate?.trim() || activity.date;
  for (const [date] of plan.daysByDate) {
    if (date >= activity.date && date <= end) return true;
  }
  return activity.date <= (plan.daysByDate.size ? [...plan.daysByDate.keys()].sort().at(-1)! : activity.date);
}

function findTransportLeg(graph: TripEntityGraph, legId: string) {
  return [...graph.outboundLegs, ...graph.returnLegs, ...graph.intercityLegs].find(
    (leg) => leg.id === legId,
  );
}

function transportLegEndpoints(leg: {
  fromCity: string;
  toCity: string;
  intercityFromCity?: string;
  intercityToCity?: string;
}): { fromKey: string; toKey: string } {
  const fromRaw =
    ("intercityFromCity" in leg && leg.intercityFromCity?.trim()) || leg.fromCity?.trim() || "";
  const toRaw =
    ("intercityToCity" in leg && leg.intercityToCity?.trim()) || leg.toCity?.trim() || "";
  return {
    fromKey: locationPaletteKey(fromRaw),
    toKey: locationPaletteKey(toRaw),
  };
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
): boolean {
  if (leg.surfaceOnly) return false;

  const travelDate = leg.travelDate?.trim();
  if (!travelDate) return plan.legIds.has(leg.id);

  const { fromKey, toKey } = transportLegEndpoints(leg);
  if (!fromKey || !toKey) return plan.legIds.has(leg.id);

  const dayCities = citiesForParticipantOnDate(plan, travelDate);
  const hasFrom = dayCities.some((city) => locationsMatch(city, fromKey) || city === fromKey);
  const hasTo = dayCities.some((city) => locationsMatch(city, toKey) || city === toKey);

  if (hasFrom && hasTo) return true;

  const arrivalDate = leg.arrivalDate?.trim() || travelDate;
  const arrivalCities = citiesForParticipantOnDate(plan, arrivalDate);
  const arrivesAtDestination = arrivalCities.some(
    (city) => locationsMatch(city, toKey) || city === toKey,
  );

  if (hasFrom && arrivesAtDestination) return true;

  // Location overlay: at destination on leg date without departing from origin (e.g. side trip).
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
  if (participantUsesTransportLeg(plan, leg)) return true;
  return plan.legIds.has(legId) && plan.mode === "independent";
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
        return plan ? stayEligible(plan, stay) : false;
      })
      .map((p) => p.id);
  }

  if (line.linkedTransportLegId) {
    return pool
      .filter((p) => {
        const plan = presence.get(p.id);
        return plan ? legEligible(plan, graph, line.linkedTransportLegId!) : false;
      })
      .map((p) => p.id);
  }

  if (line.linkedActivityId) {
    const activity = graph.activities.find((a) => a.id === line.linkedActivityId);
    if (!activity) return [];
    return pool
      .filter((p) => {
        const plan = presence.get(p.id);
        return plan ? activityEligible(plan, activity) : false;
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
  if (!line.linkedStayId && !line.linkedActivityId && !line.linkedTransportLegId) {
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
