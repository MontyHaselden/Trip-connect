import { applyTripSetupState } from "@/lib/host/setup/apply-setup-state";
import { graphToSetupState } from "./adapters";
import { syncActivitiesForTrip } from "./activities-persistence";
import type { TripEntityGraph } from "./types";

export type SaveGraphOptions = {
  activeGroupId?: string;
  /** When true, skip wizard shadow itinerary_items for transport/accommodation. */
  skipWizardItineraryItems?: boolean;
};

export async function saveTripEntityGraph(
  graph: TripEntityGraph,
  options?: SaveGraphOptions,
): Promise<{ dayCount: number }> {
  const state = graphToSetupState(graph);
  const result = await applyTripSetupState(graph.tripId, state, {
    activeGroupId: options?.activeGroupId,
    skipWizardItineraryItems: options?.skipWizardItineraryItems ?? true,
  });

  await syncActivitiesForTrip(graph.tripId, graph.activities);

  return result;
}
