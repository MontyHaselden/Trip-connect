import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { hostTripMembers, tripWizardDrafts, trips } from "@/lib/db/schema";

import { emptyWizardDraft, type TripWizardDraft } from "./types";
import { parseWizardDraft } from "./validate";

export async function assertHostTripAccess(hostId: string, tripId: string) {
  const row = await db
    .select({ id: trips.id, setupMethod: trips.setupMethod })
    .from(trips)
    .innerJoin(hostTripMembers, eq(hostTripMembers.tripId, trips.id))
    .where(and(eq(hostTripMembers.hostId, hostId), eq(trips.id, tripId)))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (!row) throw new Error("Unauthorized");
  return row;
}

export async function getWizardDraft(tripId: string): Promise<{
  currentStep: number;
  draft: TripWizardDraft;
} | null> {
  const row = await db
    .select({
      currentStep: tripWizardDrafts.currentStep,
      draftJson: tripWizardDrafts.draftJson,
    })
    .from(tripWizardDrafts)
    .where(eq(tripWizardDrafts.tripId, tripId))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (!row) return null;
  return {
    currentStep: row.currentStep,
    draft: parseWizardDraft(row.draftJson),
  };
}

export async function ensureWizardDraft(tripId: string, tripName: string) {
  const existing = await getWizardDraft(tripId);
  if (existing) return existing;

  const draft = emptyWizardDraft(tripName);
  draft.basics.name = tripName;

  await db.insert(tripWizardDrafts).values({
    tripId,
    currentStep: 1,
    draftJson: draft,
  });

  return { currentStep: 1, draft };
}

export async function saveWizardDraft(
  tripId: string,
  currentStep: number,
  draft: TripWizardDraft,
) {
  const parsed = parseWizardDraft(draft);
  await db
    .insert(tripWizardDrafts)
    .values({
      tripId,
      currentStep,
      draftJson: parsed,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: tripWizardDrafts.tripId,
      set: {
        currentStep,
        draftJson: parsed,
        updatedAt: new Date(),
      },
    });
}
