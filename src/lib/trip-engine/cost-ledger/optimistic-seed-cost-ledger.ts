import type { RosterSummary, TripEntityGraph } from "../types";
import { normalizeGraphActivities } from "../merge-graph-activities";

import { emptyCostLedgerProjection } from "./empty-projection";
import { projectionToRaw } from "./projection-to-raw";
import { projectCostLedger } from "./project";
import { buildSeedLineItems, seedItemsNotYetPresent } from "./seed-from-graph";
import { dedupeFinanceSeeds } from "./dedupe-finance-seeds";
import type { CostLedgerProjection, CostLineItemDraft } from "./types";

function optimisticIdForSeed(seed: Omit<CostLineItemDraft, "id">, index: number): string {
  if (seed.linkedActivityId) return `optimistic-activity-${seed.linkedActivityId}`;
  if (seed.linkedStayId) return `optimistic-stay-${seed.linkedStayId}`;
  if (seed.linkedTransportProductId) return `optimistic-product-${seed.linkedTransportProductId}`;
  if (seed.linkedTransportLegId) return `optimistic-leg-${seed.linkedTransportLegId}`;
  return `optimistic-seed-${index}`;
}

/** Add $0 linked finance rows for new graph entities so Finance tabs update immediately. */
export function mergeOptimisticSeedsIntoCostLedger(
  ledger: CostLedgerProjection | null | undefined,
  graph: TripEntityGraph,
  roster: RosterSummary,
): CostLedgerProjection {
  const base = ledger ?? emptyCostLedgerProjection();
  const normalizedGraph: TripEntityGraph = {
    ...graph,
    activities: normalizeGraphActivities(graph.activities),
  };
  const seeds = seedItemsNotYetPresent(base.lineItems, buildSeedLineItems(normalizedGraph));
  if (!seeds.length) return base;

  const dedupedSeeds = dedupeFinanceSeeds(base.lineItems, seeds);
  if (!dedupedSeeds.length) return base;

  const optimisticLines: CostLineItemDraft[] = dedupedSeeds.map((seed, index) => ({
    ...seed,
    id: optimisticIdForSeed(seed, index),
    sortOrder: base.lineItems.length + index,
  }));

  const raw = projectionToRaw(base);
  raw.lineItems = [...raw.lineItems, ...optimisticLines];
  return projectCostLedger(raw, roster, normalizedGraph);
}
