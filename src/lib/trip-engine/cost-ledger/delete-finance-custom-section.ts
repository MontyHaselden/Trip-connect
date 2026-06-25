import { eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { costLineItems, tripCostSettings, tripFunds } from "@/lib/db/schema";

import {
  FINANCE_OTHER_SECTION,
  isFinanceBuiltInSection,
  isFinanceCustomSection,
} from "./finance-sections";
import { ensureCostSettings, loadCostLedgerRaw } from "./load-cost-ledger";
import type { CostLedgerRaw } from "./types";

function payloadFinanceSection(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object") return undefined;
  const section = (payload as { financeSection?: unknown }).financeSection;
  return typeof section === "string" ? section : undefined;
}

/** Move manual lines and funds to Other, drop the custom tab, clear section exclusions. */
export function applyDeleteFinanceCustomSection(
  raw: CostLedgerRaw,
  sectionId: string,
): CostLedgerRaw | null {
  if (isFinanceBuiltInSection(sectionId)) return null;
  if (!isFinanceCustomSection(sectionId, raw.settings)) return null;

  const lineItems = raw.lineItems.map((line) => {
    if (payloadFinanceSection(line.allocationRulePayload) !== sectionId) return line;
    return {
      ...line,
      allocationRulePayload: {
        ...line.allocationRulePayload,
        financeSection: FINANCE_OTHER_SECTION,
      },
    };
  });

  const funds = raw.funds.map((fund) => {
    if (payloadFinanceSection(fund.allocationRulePayload) !== sectionId) return fund;
    return {
      ...fund,
      allocationRulePayload: {
        ...fund.allocationRulePayload,
        financeSection: FINANCE_OTHER_SECTION,
      },
    };
  });

  const { [sectionId]: _removed, ...financeSectionExclusions } =
    raw.settings.financeSectionExclusions;

  return {
    ...raw,
    lineItems,
    funds,
    settings: {
      ...raw.settings,
      financeCustomSections: raw.settings.financeCustomSections.filter(
        (section) => section.id !== sectionId,
      ),
      financeSectionExclusions,
    },
  };
}

export async function deleteFinanceCustomSection(
  tripId: string,
  sectionId: string,
): Promise<"ok" | "not_found" | "builtin"> {
  if (isFinanceBuiltInSection(sectionId)) return "builtin";

  await ensureCostSettings(tripId);
  const raw = await loadCostLedgerRaw(tripId);
  const next = applyDeleteFinanceCustomSection(raw, sectionId);
  if (!next) return "not_found";

  const lineIds = raw.lineItems
    .filter((line) => payloadFinanceSection(line.allocationRulePayload) === sectionId)
    .map((line) => line.id);
  const fundIds = raw.funds
    .filter((fund) => payloadFinanceSection(fund.allocationRulePayload) === sectionId)
    .map((fund) => fund.id);

  await Promise.all([
    ...lineIds.map((lineId) => {
      const line = next.lineItems.find((row) => row.id === lineId);
      if (!line) return Promise.resolve();
      return db
        .update(costLineItems)
        .set({
          allocationRulePayload: line.allocationRulePayload,
          updatedAt: new Date(),
        })
        .where(eq(costLineItems.id, lineId));
    }),
    ...fundIds.map((fundId) => {
      const fund = next.funds.find((row) => row.id === fundId);
      if (!fund) return Promise.resolve();
      return db
        .update(tripFunds)
        .set({
          allocationRulePayload: fund.allocationRulePayload,
          updatedAt: new Date(),
        })
        .where(eq(tripFunds.id, fundId));
    }),
    db
      .update(tripCostSettings)
      .set({
        financeCustomSections: next.settings.financeCustomSections,
        financeSectionExclusions: next.settings.financeSectionExclusions,
        updatedAt: new Date(),
      })
      .where(eq(tripCostSettings.tripId, tripId)),
  ]);

  return "ok";
}
