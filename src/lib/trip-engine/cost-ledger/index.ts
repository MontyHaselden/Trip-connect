import { loadCostLedgerRaw, ensureCostSettings } from "@/lib/trip-engine/cost-ledger/load-cost-ledger";
import { projectCostLedger } from "@/lib/trip-engine/cost-ledger/project";
import { syncCostLedgerFromGraph } from "@/lib/trip-engine/cost-ledger/sync-cost-ledger-from-graph";
import { loadFinanceDismissals } from "@/lib/trip-engine/cost-ledger/finance-dismissals";
import { loadTripGraph } from "@/lib/trip-engine/load-trip-graph";
import { loadRosterSummary } from "@/lib/trip-engine/roster-summary";
import type { TripEntityGraph } from "@/lib/trip-engine/types";

export async function loadCostLedgerProjection(
  tripId: string,
  graph?: TripEntityGraph | null,
) {
  await ensureCostSettings(tripId);

  const tripGraph = graph ?? (await loadTripGraph(tripId));
  if (tripGraph) {
    const dismissals = await loadFinanceDismissals(tripId);
    await syncCostLedgerFromGraph(tripId, tripGraph, dismissals);
  }

  const [raw, roster] = await Promise.all([
    loadCostLedgerRaw(tripId),
    loadRosterSummary(tripId),
  ]);
  return projectCostLedger(raw, roster, tripGraph ?? undefined);
}

export async function loadCostLedgerBundle(tripId: string, graph?: TripEntityGraph | null) {
  const projection = await loadCostLedgerProjection(tripId, graph);
  const [raw, roster] = await Promise.all([
    loadCostLedgerRaw(tripId),
    loadRosterSummary(tripId),
  ]);
  return { raw, roster, projection };
}
