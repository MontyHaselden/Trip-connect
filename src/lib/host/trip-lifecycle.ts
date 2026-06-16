import { DateTime } from "luxon";
import { inArray } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { tripOsSetupPath } from "@/lib/trip-os/paths";
import { tripWizardDrafts } from "@/lib/db/schema";
import { tripDatesAreUnset } from "@/lib/host/trip-date-display";
import type { ItineraryBuildStats } from "@/lib/host/trip-delete-eligibility";
import { isTripCompleted } from "@/lib/host/trip-delete-eligibility";
import type { TripWizardDraft } from "@/lib/host/wizard/types";
import { parseWizardDraft } from "@/lib/host/wizard/validate";

export type TripLifecycleStatus = "building" | "built" | "active" | "completed";

export type TripLifecycle = {
  status: TripLifecycleStatus;
  wizardInProgress: boolean;
  wizardStep: number | null;
  continuePath: string;
};

export type TripLifecycleInput = {
  id: string;
  setupMethod: "ai" | "wizard" | null;
  startDate: string;
  endDate: string;
  timezone: string;
};

export type WizardMeta = {
  currentStep: number;
  wizardFinished: boolean;
};

export const TRIP_STATUS_LABELS: Record<TripLifecycleStatus, string> = {
  building: "Building",
  built: "Built",
  active: "Active",
  completed: "Completed",
};

/** Legacy wizard drafts no longer gate navigation — Trip OS is the only host workspace. */
export function isWizardDraftInProgress(
  _setupMethod: TripLifecycleInput["setupMethod"],
  _wizard: WizardMeta | null | undefined,
): boolean {
  return false;
}

export function isTripActiveNow(
  trip: Pick<TripLifecycleInput, "startDate" | "endDate" | "timezone">,
): boolean {
  if (tripDatesAreUnset(trip.startDate, trip.endDate)) return false;
  const today = DateTime.now().setZone(trip.timezone).toISODate();
  if (!today) return false;
  return trip.startDate <= today && today <= trip.endDate;
}

export function resolveTripLifecycleStatus(
  trip: TripLifecycleInput,
  _wizard: WizardMeta | null | undefined,
  stats: Pick<ItineraryBuildStats, "dayCount" | "itemCount">,
): TripLifecycleStatus {
  const hasItinerary = stats.dayCount > 0 || stats.itemCount > 0;
  if (!hasItinerary && tripDatesAreUnset(trip.startDate, trip.endDate)) {
    return "building";
  }

  if (isTripCompleted(trip)) return "completed";
  if (isTripActiveNow(trip)) return "active";
  return "built";
}

export function tripContinuePath(tripId: string): string {
  return tripOsSetupPath(tripId);
}

export function resolveTripLifecycle(
  trip: TripLifecycleInput,
  _wizard: WizardMeta | null | undefined,
  stats: Pick<ItineraryBuildStats, "dayCount" | "itemCount">,
): TripLifecycle {
  const status = resolveTripLifecycleStatus(trip, _wizard, stats);

  return {
    status,
    wizardInProgress: false,
    wizardStep: null,
    continuePath: tripContinuePath(trip.id),
  };
}

export function wizardMetaFromDraft(
  currentStep: number,
  draftJson: unknown,
): WizardMeta {
  const draft = parseWizardDraft(draftJson) as TripWizardDraft & { wizardFinished?: boolean };
  return {
    currentStep,
    wizardFinished: Boolean(draft.wizardFinished),
  };
}

export async function loadWizardMetaForTrips(
  tripIds: string[],
): Promise<Map<string, WizardMeta>> {
  const result = new Map<string, WizardMeta>();
  if (!tripIds.length) return result;

  const rows = await db
    .select({
      tripId: tripWizardDrafts.tripId,
      currentStep: tripWizardDrafts.currentStep,
      draftJson: tripWizardDrafts.draftJson,
    })
    .from(tripWizardDrafts)
    .where(inArray(tripWizardDrafts.tripId, tripIds));

  for (const row of rows) {
    result.set(row.tripId, wizardMetaFromDraft(row.currentStep, row.draftJson));
  }

  return result;
}

export async function getTripLifecycleForTrip(
  trip: TripLifecycleInput,
  stats: Pick<ItineraryBuildStats, "dayCount" | "itemCount">,
): Promise<TripLifecycle> {
  return resolveTripLifecycle(trip, null, stats);
}
