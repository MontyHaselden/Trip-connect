import { mergeOptimisticSeedsIntoCostLedger } from "./optimistic-seed-cost-ledger";
import { buildSeedLineItems, seedItemsNotYetPresent } from "./seed-from-graph";
import {
  financeLinePrimaryLinkKey,
  financeSeedContentKey,
} from "./finance-line-dedupe";
import type { CostLineItemDraft } from "./types";

/** Dedupe optimistic seed batch against existing rows and within the batch itself. */
export function dedupeFinanceSeeds(
  existing: CostLineItemDraft[],
  seeds: Omit<CostLineItemDraft, "id">[],
): Omit<CostLineItemDraft, "id">[] {
  const existingLinkKeys = new Set(
    existing.map(financeLinePrimaryLinkKey).filter((key): key is string => key != null),
  );
  const existingContentKeys = new Set(
    existing.flatMap((line) => {
      const key = financeSeedContentKey(line);
      return key ? [key] : [];
    }),
  );

  return seeds.filter((seed) => {
    const linkKey = financeLinePrimaryLinkKey(seed);
    if (linkKey) {
      if (existingLinkKeys.has(linkKey)) return false;
      existingLinkKeys.add(linkKey);
      return true;
    }

    const contentKey = financeSeedContentKey(seed);
    if (contentKey) {
      if (existingContentKeys.has(contentKey)) return false;
      existingContentKeys.add(contentKey);
    }
    return true;
  });
}
