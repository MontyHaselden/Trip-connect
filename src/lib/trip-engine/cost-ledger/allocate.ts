import type { RosterSummary, TripEntityGraph } from "../types";

import {
  buildParticipantPresenceMap,
  eligibleParticipantIdsForLine,
  type ParticipantPresenceMap,
} from "./presence";
import type {
  AllocatableItem,
  CostAllocationOverrideDraft,
  CostAllocationRulePayload,
  CostAllocationRuleType,
  CostLineItemDraft,
} from "./types";

export function costSplitParticipants(roster: RosterSummary): RosterSummary["participants"] {
  return roster.participants.filter((p) => p.inCostSplit && p.role !== "host");
}

export type AllocationContext = {
  graph?: TripEntityGraph;
  presence?: ParticipantPresenceMap;
};

export function participantsForRule(
  roster: RosterSummary,
  ruleType: CostAllocationRuleType,
  payload: CostAllocationRulePayload,
  line?: CostLineItemDraft,
  ctx: AllocationContext = {},
): RosterSummary["participants"] {
  const pool = costSplitParticipants(roster);

  if (ruleType === "equal_present" && line && ctx.graph && ctx.presence) {
    const ids = eligibleParticipantIdsForLine(line, ctx.graph, roster, ctx.presence);
    return pool.filter((p) => ids.includes(p.id));
  }

  switch (ruleType) {
    case "equal_cost_participants":
    case "equal_present":
      return pool;
    case "equal_group": {
      const groupId = payload.groupId?.trim();
      if (!groupId) return [];
      return pool.filter((p) => p.groupIds.includes(groupId));
    }
    case "assign_one": {
      const participantId = payload.participantId?.trim();
      if (!participantId) return [];
      const person = roster.participants.find((p) => p.id === participantId);
      return person ? [person] : [];
    }
    case "manual":
      return pool;
    default:
      return [];
  }
}

/** Split total cents evenly; remainder goes to first N participants. */
export function splitAmountEvenly(totalCents: number, participantIds: string[]): Record<string, number> {
  if (!participantIds.length || totalCents === 0) {
    return Object.fromEntries(participantIds.map((id) => [id, 0]));
  }
  const base = Math.trunc(totalCents / participantIds.length);
  let remainder = totalCents - base * participantIds.length;
  const out: Record<string, number> = {};
  for (const id of participantIds) {
    const extra = remainder > 0 ? 1 : 0;
    if (extra) remainder -= 1;
    out[id] = base + extra;
  }
  return out;
}

export function computeItemAllocations(
  item: AllocatableItem & Partial<CostLineItemDraft>,
  roster: RosterSummary,
  overrides: CostAllocationOverrideDraft[],
  ctx: AllocationContext = {},
): {
  allocations: Record<string, number>;
  eligibleParticipantIds: string[];
  balanced: boolean;
} {
  const line = item as CostLineItemDraft;

  if (item.allocationRuleType === "manual") {
    const itemOverrides = overrides.filter((o) => o.lineItemId === item.id);
    const allocations = Object.fromEntries(
      itemOverrides.map((o) => [o.participantId, o.amountCents]),
    );
    const allocatedTotal = Object.values(allocations).reduce((sum, n) => sum + n, 0);
    return {
      allocations,
      eligibleParticipantIds: Object.keys(allocations),
      balanced: allocatedTotal === item.totalAmountCents,
    };
  }

  let targets = participantsForRule(
    roster,
    item.allocationRuleType,
    item.allocationRulePayload,
    line.id ? line : undefined,
    ctx,
  );

  if (
    item.allocationRuleType === "equal_present" &&
    line &&
    ctx.graph &&
    ctx.presence
  ) {
    const eligibleIds = eligibleParticipantIdsForLine(line, ctx.graph, roster, ctx.presence);
    targets = targets.filter((p) => eligibleIds.includes(p.id));
  }

  const eligibleParticipantIds = targets.map((p) => p.id);
  const allocations = splitAmountEvenly(
    item.totalAmountCents,
    eligibleParticipantIds,
  );
  const allocatedTotal = Object.values(allocations).reduce((sum, n) => sum + n, 0);
  return {
    allocations,
    eligibleParticipantIds,
    balanced: allocatedTotal === item.totalAmountCents,
  };
}

export { buildParticipantPresenceMap, eligibleParticipantIdsForLine };
