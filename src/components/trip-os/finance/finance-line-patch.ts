import type { CostLineFormValues } from "../costs/CostLineDrawer";
import type { CostLineItemDraft, FinanceManualSection, LineAllocationResult } from "@/lib/trip-engine/cost-ledger/types";

export function lineToFormValues(
  line: CostLineItemDraft,
): Omit<CostLineFormValues, "lineId"> & { lineId: string } {
  return {
    lineId: line.id,
    category: line.category,
    description: line.description,
    notes: line.notes ?? "",
    totalAmountCents: line.totalAmountCents,
    currency: line.currency,
    quantity: line.quantity,
    allocationRuleType: line.allocationRuleType,
    groupId: line.allocationRulePayload.groupId ?? "",
    participantId: line.allocationRulePayload.participantId ?? "",
  };
}

export function linePayload(values: CostLineFormValues): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    category: values.category,
    description: values.description,
    notes: values.notes || null,
    totalAmountCents: values.totalAmountCents,
    currency: values.currency,
    quantity: values.quantity,
    allocationRuleType: values.allocationRuleType,
    allocationRulePayload: {},
  };
  if (values.allocationRuleType === "equal_group" && values.groupId) {
    payload.allocationRulePayload = { groupId: values.groupId };
  }
  if (values.allocationRuleType === "assign_one" && values.participantId) {
    payload.allocationRulePayload = { participantId: values.participantId };
  }
  return payload;
}

export function extraLinePayload(
  section: FinanceManualSection,
  baseCurrency: string,
): Record<string, unknown> {
  return {
    category: "other",
    description: "New line",
    notes: null,
    totalAmountCents: 0,
    currency: baseCurrency,
    quantity: null,
    allocationRuleType: "equal_cost_participants",
    allocationRulePayload: { financeSection: section },
  };
}

export function patchBulkParticipantAllocations(
  line: CostLineItemDraft,
  lineAlloc: LineAllocationResult,
  updates: { participantId: string; amountCents: number | null }[],
  options?: { syncTotalToPins?: boolean },
): Record<string, unknown> {
  const pinned = new Map<string, number>();
  for (const id of lineAlloc.pinnedParticipantIds) {
    pinned.set(id, lineAlloc.allocations[id] ?? 0);
  }
  for (const { participantId, amountCents } of updates) {
    if (amountCents == null || amountCents <= 0) pinned.delete(participantId);
    else pinned.set(participantId, amountCents);
  }

  const overrides = [...pinned.entries()].map(([participantId, amountCents]) => ({
    participantId,
    amountCents,
  }));
  const pinnedSum = [...pinned.values()].reduce((sum, cents) => sum + cents, 0);

  const payload: Record<string, unknown> = { overrides };
  const syncTotal = options?.syncTotalToPins !== false;
  if (syncTotal) {
    if (pinnedSum > 0) payload.totalAmountCents = pinnedSum;
    else if (pinned.size === 0 && line.totalAmountCents > 0) payload.totalAmountCents = 0;
  } else if (pinnedSum > 0 && line.totalAmountCents < pinnedSum) {
    payload.totalAmountCents = pinnedSum;
  }
  return payload;
}

export function patchParticipantAllocation(
  line: CostLineItemDraft,
  lineAlloc: LineAllocationResult,
  participantId: string,
  amountCents: number | null,
): Record<string, unknown> {
  return patchBulkParticipantAllocations(
    line,
    lineAlloc,
    [{ participantId, amountCents }],
    { syncTotalToPins: false },
  );
}

export function patchLinePayload(
  line: CostLineItemDraft,
  patch: Partial<CostLineFormValues>,
): Record<string, unknown> {
  const current = lineToFormValues(line);
  const payload = linePayload({ ...current, ...patch, lineId: line.id });
  if (line.allocationRulePayload.financeSection) {
    payload.allocationRulePayload = {
      ...(payload.allocationRulePayload as Record<string, unknown>),
      financeSection: line.allocationRulePayload.financeSection,
    };
  }
  if (patch.totalAmountCents === 0) {
    payload.overrides = [];
  }
  return payload;
}
