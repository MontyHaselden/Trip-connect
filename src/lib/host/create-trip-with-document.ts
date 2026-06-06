import { createTripForHost } from "@/lib/host/trip-create";

/** Creates a bare trip shell — document import runs separately for live builder preview. */
import { db } from "@/lib/db/client";
import { tripWizardDrafts } from "@/lib/db/schema";
import { emptyWizardDraft } from "@/lib/host/wizard/types";

export async function createTripShell(params: {
  hostId: string;
  name: string;
  timezone?: string;
  setupMethod?: "ai" | "wizard";
}) {
  const timezone = params.timezone?.trim() || "UTC";
  const setupMethod = params.setupMethod ?? "ai";
  const trip = await createTripForHost({
    hostId: params.hostId,
    name: params.name.trim(),
    schoolName: "School trip",
    timezone,
    defaultCountryCallingCode: "NZ",
    setupMethod,
  });

  if (setupMethod === "wizard") {
    const draft = emptyWizardDraft(params.name.trim());
    await db.insert(tripWizardDrafts).values({
      tripId: trip.id,
      currentStep: 1,
      draftJson: draft,
    });
  }

  return trip;
}
