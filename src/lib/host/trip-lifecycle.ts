import { DateTime } from "luxon";
import { inArray } from "drizzle-orm";

import { db } from "@/lib/db/client";
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

export function isWizardDraftInProgress(
  setupMethod: TripLifecycleInput["setupMethod"],
  wizard: WizardMeta | null | undefined,
): boolean {
  if (setupMethod !== "wizard" || !wizard) return false;
  return !wizard.wizardFinished;
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
  wizard: WizardMeta | null | undefined,
  stats: Pick<ItineraryBuildStats, "dayCount" | "itemCount">,
): TripLifecycleStatus {
  if (isWizardDraftInProgress(trip.setupMethod, wizard)) return "building";

  const hasItinerary = stats.dayCount > 0 || stats.itemCount > 0;
  if (!hasItinerary && tripDatesAreUnset(trip.startDate, trip.endDate)) {
    return "building";
  }

  if (isTripCompleted(trip)) return "completed";
  if (isTripActiveNow(trip)) return "active";
  return "built";
}

export function tripContinuePath(
  tripId: string,
  status: TripLifecycleStatus,
  wizardStep: number | null,
): string {
  if (status === "building" && wizardStep) {
    return `/dashboard/trips/${tripId}/wizard?step=${wizardStep}`;
  }
  return `/dashboard/trips/${tripId}/builder`;
}

export function resolveTripLifecycle(
  trip: TripLifecycleInput,
  wizard: WizardMeta | null | undefined,
  stats: Pick<ItineraryBuildStats, "dayCount" | "itemCount">,
): TripLifecycle {
  const wizardInProgress = isWizardDraftInProgress(trip.setupMethod, wizard);
  const status = resolveTripLifecycleStatus(trip, wizard, stats);
  const wizardStep = wizardInProgress ? (wizard?.currentStep ?? 1) : null;

  return {
    status,
    wizardInProgress,
    wizardStep,
    continuePath: tripContinuePath(trip.id, status, wizardStep),
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
  const wizardRows = await loadWizardMetaForTrips([trip.id]);
  return resolveTripLifecycle(trip, wizardRows.get(trip.id), stats);
}
