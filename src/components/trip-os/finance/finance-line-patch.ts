import type { CostLineFormValues } from "../costs/CostLineDrawer";
import type { CostStatus } from "@/lib/trip-engine/cost-ledger/finance-metadata";
import type { FinanceEntitySection } from "@/lib/trip-engine/cost-ledger/finance-sections";
import type { CostLineItemDraft, LineAllocationResult } from "@/lib/trip-engine/cost-ledger/types";

export type FinanceLinePatch = Partial<CostLineFormValues> & {
  costStatus?: CostStatus;
};

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
  section: FinanceEntitySection,
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

function toWholeCents(value: number): number {
  return Math.trunc(value);
}

export function patchBulkParticipantAllocations(
  line: CostLineItemDraft,
  lineAlloc: LineAllocationResult,
  updates: { participantId: string; amountCents: number | null }[],
  options?: { syncTotalToPins?: boolean; replacePins?: boolean },
): Record<string, unknown> {
  const pinned = new Map<string, number>();
  if (!options?.replacePins) {
    for (const id of lineAlloc.pinnedParticipantIds) {
      const cents = toWholeCents(lineAlloc.allocations[id] ?? 0);
      if (cents > 0) pinned.set(id, cents);
    }
  }
  for (const { participantId, amountCents } of updates) {
    if (amountCents == null || amountCents <= 0) pinned.delete(participantId);
    else pinned.set(participantId, toWholeCents(amountCents));
  }

  const overrides = [...pinned.entries()].map(([participantId, amountCents]) => ({
    participantId,
    amountCents,
  }));
  const pinnedSum = overrides.reduce((sum, row) => sum + row.amountCents, 0);

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

/** Send only the fields being edited — never blank out financeSection with an empty payload. */
export function patchLinePayload(
  line: CostLineItemDraft,
  patch: FinanceLinePatch,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {};

  if (patch.costStatus !== undefined) {
    payload.costStatus = patch.costStatus;
  }

  if (patch.description !== undefined) {
    const trimmed = patch.description.trim();
    if (trimmed) payload.description = trimmed;
  }
  if (patch.notes !== undefined) payload.notes = patch.notes || null;
  if (patch.totalAmountCents !== undefined) {
    payload.totalAmountCents = patch.totalAmountCents;
    if (patch.totalAmountCents === 0) payload.overrides = [];
  }
  if (patch.currency !== undefined) payload.currency = patch.currency.toUpperCase();
  if (patch.quantity !== undefined) payload.quantity = patch.quantity;

  const ruleTouched =
    patch.allocationRuleType !== undefined ||
    patch.groupId !== undefined ||
    patch.participantId !== undefined;

  if (ruleTouched) {
    const merged = { ...lineToFormValues(line), ...patch, lineId: line.id };
    const built = linePayload(merged);
    payload.allocationRuleType = built.allocationRuleType;
    payload.allocationRulePayload = built.allocationRulePayload;
    if (line.allocationRulePayload.financeSection) {
      payload.allocationRulePayload = {
        ...(payload.allocationRulePayload as Record<string, unknown>),
        financeSection: line.allocationRulePayload.financeSection,
      };
    }
  }

  return payload;
}
