import type { RosterSummary, TripEntityGraph } from "../types";

import { reorderFinanceSectionLines } from "./finance-line-order";
import { applySectionExclusionPatch } from "./finance-section-exclusions";
import { applyDeleteFinanceCustomSection } from "./delete-finance-custom-section";
import { financeSectionForLine } from "./finance-sections";
import { projectionToRaw } from "./projection-to-raw";
import { projectCostLedger } from "./project";
import type {
  CostLedgerProjection,
  CostLineItemDraft,
  TripFundDraft,
} from "./types";

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
  if (typeof patch.costStatus === "string") {
    next.costStatus = patch.costStatus as CostLineItemDraft["costStatus"];
  }
  return next;
}

export function isOptimisticFinanceLineId(id: string): boolean {
  return id.startsWith("optimistic-");
}

export function isOptimisticFinanceFundId(id: string): boolean {
  return id.startsWith("optimistic-fund-");
}

/** Whether a fund delete should hit the server, using the ledger before optimistic UI removal. */
export function resolveFundDeleteServerPayload(
  payload: Record<string, unknown>,
  fundsBeforeOptimistic: TripFundDraft[],
): { skipServer: boolean; payload: Record<string, unknown> } {
  const action = payload.action;
  if (action === "deleteFund" && typeof payload.fundId === "string") {
    if (isOptimisticFinanceFundId(payload.fundId)) {
      return { skipServer: true, payload };
    }
    return { skipServer: false, payload };
  }
  if (action === "deleteFunds" && Array.isArray(payload.fundIds)) {
    const requested = payload.fundIds as string[];
    const serverIds = requested.filter(
      (id) =>
        !isOptimisticFinanceFundId(id) &&
        fundsBeforeOptimistic.some((fund) => fund.id === id),
    );
    if (!serverIds.length) return { skipServer: true, payload };
    if (serverIds.length === requested.length) return { skipServer: false, payload };
    return { skipServer: false, payload: { ...payload, fundIds: serverIds } };
  }
  return { skipServer: false, payload };
}

export function resolveOptimisticFinanceLineId(
  lineId: string,
  mapping: ReadonlyMap<string, string>,
): string | null {
  if (!isOptimisticFinanceLineId(lineId)) return lineId;
  return mapping.get(lineId) ?? null;
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

  if (action === "reorderSectionLines") {
    const section = payload.section;
    const orderedIds = payload.orderedIds;
    if (
      typeof section !== "string" ||
      !Array.isArray(orderedIds) ||
      !orderedIds.every((id) => typeof id === "string")
    ) {
      return null;
    }
    try {
      raw.lineItems = reorderFinanceSectionLines(
        raw.lineItems,
        section,
        orderedIds as string[],
        graph,
        raw.settings,
      );
    } catch {
      return null;
    }
    return projectCostLedger(raw, roster, graph ?? undefined);
  }

  if (action === "addFinanceSection") {
    const name = payload.name;
    if (typeof name !== "string" || !name.trim()) return null;
    const description =
      typeof payload.description === "string" ? payload.description.trim() : "";
    const id = `optimistic-section-${Date.now()}`;
    raw.settings = {
      ...raw.settings,
      financeCustomSections: [
        ...raw.settings.financeCustomSections,
        { id, name: name.trim(), description: description || null },
      ],
    };
    return projectCostLedger(raw, roster, graph ?? undefined);
  }

  if (action === "deleteFinanceSection") {
    const sectionId = payload.sectionId;
    if (typeof sectionId !== "string" || !sectionId.trim()) return null;
    const next = applyDeleteFinanceCustomSection(raw, sectionId.trim());
    if (!next) return null;
    return projectCostLedger(next, roster, graph ?? undefined);
  }

  if (action === "updateFinanceViewGroups") {
    const groups = payload.groups;
    if (!Array.isArray(groups)) return null;
    raw.settings = {
      ...raw.settings,
      financeViewGroups: groups as typeof raw.settings.financeViewGroups,
    };
    return projectCostLedger(raw, roster, graph ?? undefined);
  }

  if (action === "setFinanceSectionParticipant") {
    const section = payload.section;
    const participantId = payload.participantId;
    const excluded = payload.excluded === true;
    if (typeof section !== "string" || typeof participantId !== "string") return null;

    raw.settings = {
      ...raw.settings,
      financeSectionExclusions: applySectionExclusionPatch(
        raw.settings.financeSectionExclusions,
        section,
        participantId,
        excluded,
      ),
    };

    if (excluded && graph) {
      const lineIds = new Set(
        raw.lineItems
          .filter((line) => financeSectionForLine(line, graph, raw.settings) === section)
          .map((line) => line.id),
      );
      if (lineIds.size) {
        raw.overrides = raw.overrides.filter(
          (row) => !(row.participantId === participantId && lineIds.has(row.lineItemId)),
        );
      }
    }

    return projectCostLedger(raw, roster, graph ?? undefined);
  }

  if (action === "addLine") {
    const line = payload.line;
    if (!line || typeof line !== "object") return null;
    const parsed = line as Record<string, unknown>;
    const financeSection = (parsed.allocationRulePayload as { financeSection?: string } | undefined)
      ?.financeSection;
    const tempId = `optimistic-${Date.now()}`;
    raw.lineItems.push({
      id: tempId,
      sortOrder: raw.lineItems.length,
      category: (parsed.category as CostLineItemDraft["category"]) ?? "other",
      description: typeof parsed.description === "string" ? parsed.description : "New line",
      notes: null,
      totalAmountCents: 0,
      currency: typeof parsed.currency === "string" ? parsed.currency : "NZD",
      quantity: null,
      allocationRuleType: "equal_cost_participants",
      allocationRulePayload: financeSection
        ? { financeSection: financeSection as CostLineItemDraft["allocationRulePayload"]["financeSection"] }
        : {},
      linkedStayId: null,
      linkedTransportLegId: null,
      linkedActivityId: null,
      scope: "trip_wide",
      supplierPaymentStatus: null,
      costStatus: "unknown",
      linePaymentStatus: "unpaid",
      fundingStatus: "unfunded",
      supplierName: null,
      estimatedAmountCents: null,
      actualAmountCents: null,
      taxTreatment: "unknown",
      exportCategoryLabel: null,
      exportReference: null,
      bookingReference: null,
      invoiceRecorded: false,
      receiptRecorded: false,
    });
    return projectCostLedger(raw, roster, graph ?? undefined);
  }

  if (action === "addFund") {
    const fund = payload.fund;
    if (!fund || typeof fund !== "object") return null;
    const parsed = fund as Record<string, unknown>;
    const rulePayload = (parsed.allocationRulePayload as Record<string, unknown>) ?? {};
    const tempId = `optimistic-fund-${Date.now()}`;
    raw.funds.push({
      id: tempId,
      name: typeof parsed.name === "string" ? parsed.name : "New line",
      amountCents: typeof parsed.amountCents === "number" ? parsed.amountCents : 0,
      currency:
        typeof parsed.currency === "string" ? parsed.currency : raw.settings.baseCurrency,
      allocationRuleType:
        (parsed.allocationRuleType as TripFundDraft["allocationRuleType"]) ??
        "equal_cost_participants",
      allocationRulePayload: {
        groupId: typeof rulePayload.groupId === "string" ? rulePayload.groupId : undefined,
        participantId:
          typeof rulePayload.participantId === "string" ? rulePayload.participantId : undefined,
        financeSection: rulePayload.financeSection as CostLineItemDraft["allocationRulePayload"]["financeSection"],
      },
      sortOrder: raw.funds.length,
      notes: null,
    });
    return projectCostLedger(raw, roster, graph ?? undefined);
  }

  if (action === "deleteFund") {
    const fundId = payload.fundId;
    if (typeof fundId !== "string") return null;
    raw.funds = raw.funds.filter((fund) => fund.id !== fundId);
    return projectCostLedger(raw, roster, graph ?? undefined);
  }

  if (action === "deleteFunds") {
    const fundIds = payload.fundIds;
    if (!Array.isArray(fundIds) || !fundIds.every((id) => typeof id === "string")) {
      return null;
    }
    const remove = new Set(fundIds as string[]);
    raw.funds = raw.funds.filter((fund) => !remove.has(fund.id));
    return projectCostLedger(raw, roster, graph ?? undefined);
  }

  if (action === "deletePayment") {
    const paymentId = payload.paymentId;
    if (typeof paymentId !== "string") return null;
    raw.payments = raw.payments.filter((payment) => payment.id !== paymentId);
    return projectCostLedger(raw, roster, graph ?? undefined);
  }

  if (action === "updateFund") {
    const fundId = payload.fundId;
    const patch = payload.fund;
    if (typeof fundId !== "string" || !patch || typeof patch !== "object") return null;
    const index = raw.funds.findIndex((fund) => fund.id === fundId);
    if (index < 0) return null;
    const current = raw.funds[index]!;
    const parsed = patch as Record<string, unknown>;
    const rulePatch = parsed.allocationRulePayload;
    raw.funds[index] = {
      ...current,
      ...(typeof parsed.name === "string" ? { name: parsed.name } : {}),
      ...(typeof parsed.amountCents === "number" ? { amountCents: parsed.amountCents } : {}),
      ...(typeof parsed.currency === "string" ? { currency: parsed.currency } : {}),
      ...(rulePatch && typeof rulePatch === "object"
        ? {
            allocationRulePayload: {
              ...current.allocationRulePayload,
              ...(rulePatch as TripFundDraft["allocationRulePayload"]),
            },
          }
        : {}),
    };
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
    const pinnedSum = overrides.reduce((sum, row) => sum + row.amountCents, 0);
    if (pinnedSum > 0 && raw.lineItems[lineIndex]!.totalAmountCents < pinnedSum) {
      raw.lineItems[lineIndex] = {
        ...raw.lineItems[lineIndex]!,
        totalAmountCents: pinnedSum,
      };
    }
  }

  return projectCostLedger(raw, roster, graph ?? undefined);
}
