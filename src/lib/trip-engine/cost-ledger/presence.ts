import { locationPaletteKey } from "@/lib/host/wizard/location-stays";
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

function legEligible(plan: ResolvedParticipantPlan, legId: string): boolean {
  return plan.legIds.has(legId);
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
        return plan ? legEligible(plan, line.linkedTransportLegId!) : false;
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
