import type { CostLineFormValues } from "../costs/CostLineDrawer";
import type { CostLineItemDraft } from "@/lib/trip-engine/cost-ledger/types";

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

export function patchLinePayload(
  line: CostLineItemDraft,
  patch: Partial<CostLineFormValues>,
): Record<string, unknown> {
  const current = lineToFormValues(line);
  return linePayload({ ...current, ...patch, lineId: line.id });
}
