import { eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { costLineItems, tripCostSettings, tripFunds } from "@/lib/db/schema";

import { FINANCE_OTHER_SECTION } from "./finance-sections";
import { loadCostLedgerRaw } from "./load-cost-ledger";
import { isOrphanFinanceFund } from "./finance-fund-sections";
import type { TripFundDraft } from "./types";

function payloadFinanceSection(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object") return undefined;
  const section = (payload as { financeSection?: unknown }).financeSection;
  return typeof section === "string" ? section : undefined;
}

async function reassignFinanceSectionInDb(
  tripId: string,
  fromSection: string,
  toSection: string,
): Promise<boolean> {
  let changed = false;

  const [lines, funds] = await Promise.all([
    db.select().from(costLineItems).where(eq(costLineItems.tripId, tripId)),
    db.select().from(tripFunds).where(eq(tripFunds.tripId, tripId)),
  ]);

  await Promise.all(
    lines
      .filter((line) => payloadFinanceSection(line.allocationRulePayload) === fromSection)
      .map((line) => {
        changed = true;
        const payload = {
          ...((line.allocationRulePayload ?? {}) as Record<string, unknown>),
          financeSection: toSection,
        };
        return db
          .update(costLineItems)
          .set({ allocationRulePayload: payload, updatedAt: new Date() })
          .where(eq(costLineItems.id, line.id));
      }),
  );

  await Promise.all(
    funds
      .filter((fund) => payloadFinanceSection(fund.allocationRulePayload) === fromSection)
      .map((fund) => {
        changed = true;
        const payload = {
          ...((fund.allocationRulePayload ?? {}) as Record<string, unknown>),
          financeSection: toSection,
        };
        return db
          .update(tripFunds)
          .set({ allocationRulePayload: payload, updatedAt: new Date() })
          .where(eq(tripFunds.id, fund.id));
      }),
  );

  return changed;
}

async function persistOrphanFinanceFundSections(funds: TripFundDraft[]): Promise<boolean> {
  const orphans = funds.filter(isOrphanFinanceFund);
  if (!orphans.length) return false;

  await Promise.all(
    orphans.map((fund) =>
      db
        .update(tripFunds)
        .set({
          allocationRulePayload: {
            ...fund.allocationRulePayload,
            financeSection: FINANCE_OTHER_SECTION,
          },
          updatedAt: new Date(),
        })
        .where(eq(tripFunds.id, fund.id)),
    ),
  );

  return true;
}

/**
 * Ensure a single permanent Other tab: migrate legacy custom "Other" sections,
 * orphan payment rows, and duplicate settings.
 */
export async function consolidateFinanceOtherSection(tripId: string): Promise<boolean> {
  const raw = await loadCostLedgerRaw(tripId);
  let changed = false;

  const legacyOtherSections = raw.settings.financeCustomSections.filter((section) =>
    /^other$/i.test(section.name.trim()),
  );

  for (const legacy of legacyOtherSections) {
    if (await reassignFinanceSectionInDb(tripId, legacy.id, FINANCE_OTHER_SECTION)) {
      changed = true;
    }
  }

  if (legacyOtherSections.length) {
    const removeIds = new Set(legacyOtherSections.map((section) => section.id));
    const nextSections = raw.settings.financeCustomSections.filter(
      (section) => !removeIds.has(section.id),
    );
    await db
      .update(tripCostSettings)
      .set({ financeCustomSections: nextSections, updatedAt: new Date() })
      .where(eq(tripCostSettings.tripId, tripId));
    changed = true;
  }

  if (await persistOrphanFinanceFundSections(raw.funds)) {
    changed = true;
  }

  return changed;
}
