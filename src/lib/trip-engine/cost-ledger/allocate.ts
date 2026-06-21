import type { RosterSummary } from "../types";

import type {
  AllocatableItem,
  CostAllocationOverrideDraft,
  CostAllocationRulePayload,
  CostAllocationRuleType,
} from "./types";

export function costSplitParticipants(roster: RosterSummary): RosterSummary["participants"] {
  return roster.participants.filter((p) => p.inCostSplit && p.role !== "host");
}

export function participantsForRule(
  roster: RosterSummary,
  ruleType: CostAllocationRuleType,
  payload: CostAllocationRulePayload,
): RosterSummary["participants"] {
  const pool = costSplitParticipants(roster);
  switch (ruleType) {
    case "equal_cost_participants":
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
  item: AllocatableItem,
  roster: RosterSummary,
  overrides: CostAllocationOverrideDraft[],
): { allocations: Record<string, number>; balanced: boolean } {
  if (item.allocationRuleType === "manual") {
    const itemOverrides = overrides.filter((o) => o.lineItemId === item.id);
    const allocations = Object.fromEntries(
      itemOverrides.map((o) => [o.participantId, o.amountCents]),
    );
    const allocatedTotal = Object.values(allocations).reduce((sum, n) => sum + n, 0);
    return {
      allocations,
      balanced: allocatedTotal === item.totalAmountCents,
    };
  }

  const targets = participantsForRule(
    roster,
    item.allocationRuleType,
    item.allocationRulePayload,
  );
  const allocations = splitAmountEvenly(
    item.totalAmountCents,
    targets.map((p) => p.id),
  );
  const allocatedTotal = Object.values(allocations).reduce((sum, n) => sum + n, 0);
  return {
    allocations,
    balanced: allocatedTotal === item.totalAmountCents,
  };
}
