import type { RosterSummary, TripEntityGraph } from "../types";

import { projectCostLedger } from "./project";
import type {
  CostAllocationOverrideDraft,
  CostLedgerProjection,
  CostLedgerRaw,
  CostLineItemDraft,
} from "./types";

function projectionToRaw(ledger: CostLedgerProjection): CostLedgerRaw {
  const overrides: CostAllocationOverrideDraft[] = [];
  for (const alloc of ledger.lineAllocations) {
    for (const participantId of alloc.pinnedParticipantIds) {
      overrides.push({
        lineItemId: alloc.lineItemId,
        participantId,
        amountCents: alloc.allocations[participantId] ?? 0,
      });
    }
  }

  return {
    settings: ledger.settings,
    lineItems: ledger.lineItems.map((line) => ({ ...line })),
    overrides,
    funds: ledger.funds.map((fund) => ({ ...fund })),
    payments: ledger.payments.map((payment) => ({ ...payment })),
    supplierPayments: ledger.supplierPayments.map((payment) => ({ ...payment })),
  };
}

function applyLinePatch(
  line: CostLineItemDraft,
  patch: Record<string, unknown>,
): CostLineItemDraft {
  const next = { ...line };
  if (typeof patch.description === "string") next.description = patch.description;
  if (patch.notes !== undefined) next.notes = (patch.notes as string | null) ?? null;
  if (typeof patch.totalAmountCents === "number") next.totalAmountCents = patch.totalAmountCents;
  if (typeof patch.currency === "string") next.currency = patch.currency;
  if (patch.quantity !== undefined) {
    next.quantity =
      patch.quantity == null ? null : Number(patch.quantity);
  }
  if (typeof patch.allocationRuleType === "string") {
    next.allocationRuleType = patch.allocationRuleType as CostLineItemDraft["allocationRuleType"];
  }
  if (patch.allocationRulePayload && typeof patch.allocationRulePayload === "object") {
    next.allocationRulePayload = {
      ...next.allocationRulePayload,
      ...(patch.allocationRulePayload as CostLineItemDraft["allocationRulePayload"]),
    };
  }
  return next;
}

/** Apply a finance PATCH payload locally so the grid updates instantly. */
export function applyOptimisticFinancePatch(
  ledger: CostLedgerProjection,
  roster: RosterSummary,
  graph: TripEntityGraph | null | undefined,
  payload: Record<string, unknown>,
): CostLedgerProjection | null {
  const action = payload.action;
  const raw = projectionToRaw(ledger);

  if (action === "deleteLines") {
    const lineIds = payload.lineIds;
    if (!Array.isArray(lineIds) || !lineIds.every((id) => typeof id === "string")) {
      return null;
    }
    const remove = new Set(lineIds as string[]);
    raw.lineItems = raw.lineItems.filter((line) => !remove.has(line.id));
    raw.overrides = raw.overrides.filter((row) => !remove.has(row.lineItemId));
    return projectCostLedger(raw, roster, graph ?? undefined);
  }

  if (action !== "updateLine") return null;

  const lineId = payload.lineId;
  const patch = payload.line;
  if (typeof lineId !== "string" || !patch || typeof patch !== "object") return null;

  const lineIndex = raw.lineItems.findIndex((line) => line.id === lineId);
  if (lineIndex < 0) return null;

  raw.lineItems[lineIndex] = applyLinePatch(raw.lineItems[lineIndex]!, patch as Record<string, unknown>);

  if (Array.isArray((patch as { overrides?: unknown }).overrides)) {
    const overrides = (patch as { overrides: { participantId: string; amountCents: number }[] })
      .overrides;
    raw.overrides = raw.overrides.filter((row) => row.lineItemId !== lineId);
    for (const override of overrides) {
      raw.overrides.push({
        lineItemId: lineId,
        participantId: override.participantId,
        amountCents: override.amountCents,
      });
    }
  }

  return projectCostLedger(raw, roster, graph ?? undefined);
}
