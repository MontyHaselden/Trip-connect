import type { RosterSummary, TripEntityGraph } from "../types";

import {
  buildParticipantPresenceMap,
  eligibleParticipantIdsForLine,
  type ParticipantPresenceMap,
} from "./presence";
import {
  participantNightsAtStay,
  splitByNightUnits,
  splitWithPinnedOverridesByNights,
  stayForLine,
} from "./accommodation-nights";
import { isAllocationBalanced, splitAmountEvenly, splitWithPinnedOverrides } from "./smart-split";
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

export { splitAmountEvenly, splitWithPinnedOverrides, isAllocationBalanced } from "./smart-split";

export function computeItemAllocations(
  item: AllocatableItem & Partial<CostLineItemDraft>,
  roster: RosterSummary,
  overrides: CostAllocationOverrideDraft[],
  ctx: AllocationContext = {},
): {
  allocations: Record<string, number>;
  eligibleParticipantIds: string[];
  pinnedParticipantIds: string[];
  balanced: boolean;
} {
  const line = item as CostLineItemDraft;
  const itemOverrides = overrides.filter((o) => o.lineItemId === item.id);
  const pinnedParticipantIds = itemOverrides.map((o) => o.participantId);
  const pinnedOverrides = Object.fromEntries(
    itemOverrides.map((o) => [o.participantId, o.amountCents]),
  );

  if (item.allocationRuleType === "manual") {
    const allocations = Object.fromEntries(
      itemOverrides.map((o) => [o.participantId, o.amountCents]),
    );
    return {
      allocations,
      eligibleParticipantIds: Object.keys(allocations),
      pinnedParticipantIds,
      balanced: isAllocationBalanced(item.totalAmountCents, allocations),
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

  if (itemOverrides.length > 0) {
    const allocations =
      line.linkedStayId && item.quantity && item.quantity > 0 && ctx.graph && ctx.presence
        ? (() => {
            const stay = stayForLine(line, ctx.graph);
            if (!stay) {
              return splitWithPinnedOverrides(
                item.totalAmountCents,
                eligibleParticipantIds,
                pinnedOverrides,
              );
            }
            const nightUnits = Object.fromEntries(
              eligibleParticipantIds.map((id) => {
                const plan = ctx.presence!.get(id);
                return [id, plan ? participantNightsAtStay(plan, stay) : 0];
              }),
            );
            const hasNightWeights = Object.values(nightUnits).some((n) => n > 0);
            if (!hasNightWeights) {
              return splitWithPinnedOverrides(
                item.totalAmountCents,
                eligibleParticipantIds,
                pinnedOverrides,
              );
            }
            return splitWithPinnedOverridesByNights(
              item.totalAmountCents,
              eligibleParticipantIds,
              pinnedOverrides,
              nightUnits,
            );
          })()
        : splitWithPinnedOverrides(
            item.totalAmountCents,
            eligibleParticipantIds,
            pinnedOverrides,
          );
    return {
      allocations,
      eligibleParticipantIds,
      pinnedParticipantIds,
      balanced: isAllocationBalanced(item.totalAmountCents, allocations),
    };
  }

  const stayNightSplit =
    line.linkedStayId && item.quantity && item.quantity > 0 && ctx.graph && ctx.presence
      ? (() => {
          const stay = stayForLine(line, ctx.graph);
          if (!stay) return null;
          const nightUnits = Object.fromEntries(
            eligibleParticipantIds.map((id) => {
              const plan = ctx.presence!.get(id);
              return [id, plan ? participantNightsAtStay(plan, stay) : 0];
            }),
          );
          if (!Object.values(nightUnits).some((n) => n > 0)) return null;
          return splitByNightUnits(item.totalAmountCents, nightUnits);
        })()
      : null;

  const allocations =
    stayNightSplit ??
    splitAmountEvenly(item.totalAmountCents, eligibleParticipantIds);
  return {
    allocations,
    eligibleParticipantIds,
    pinnedParticipantIds: [],
    balanced: isAllocationBalanced(item.totalAmountCents, allocations),
  };
}

export { buildParticipantPresenceMap, eligibleParticipantIdsForLine };
