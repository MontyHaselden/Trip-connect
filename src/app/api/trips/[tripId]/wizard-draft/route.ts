import { NextResponse } from "next/server";
import { z } from "zod";

import { requireHostSessionHostId } from "@/lib/auth/host-session";
import { hostApiError } from "@/lib/host/api-errors";
import {
  assertHostTripAccess,
  ensureWizardDraft,
  getTripWizardContext,
  getWizardDraft,
  hydrateWizardDraftFromTrip,
  saveWizardDraft,
} from "@/lib/host/wizard/draft-queries";
import { parseWizardDraft } from "@/lib/host/wizard/validate";

export const runtime = "nodejs";

const PatchSchema = z.object({
  currentStep: z.number().int().min(1).max(8),
  draft: z.unknown(),
});

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ tripId: string }> },
) {
  try {
    const hostId = await requireHostSessionHostId();
    const { tripId } = await ctx.params;
    await assertHostTripAccess(hostId, tripId);

    const trip = await getTripWizardContext(tripId);
    if (!trip) {
      return NextResponse.json({ error: "Trip not found." }, { status: 404 });
    }

    let row = await getWizardDraft(tripId);
    if (!row) {
      row = await ensureWizardDraft(tripId, trip.name);
    }

    const draft = hydrateWizardDraftFromTrip(row.draft, trip);
    if (JSON.stringify(draft) !== JSON.stringify(row.draft)) {
      await saveWizardDraft(tripId, row.currentStep, draft);
    }

    return NextResponse.json({ currentStep: row.currentStep, draft, tripName: trip.name });
  } catch (err) {
    return hostApiError(err);
  }
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ tripId: string }> },
) {
  try {
    const hostId = await requireHostSessionHostId();
    const { tripId } = await ctx.params;
    await assertHostTripAccess(hostId, tripId);

    const body = await req.json().catch(() => null);
    const parsed = PatchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid wizard draft." }, { status: 400 });
    }

    const draft = parseWizardDraft(parsed.data.draft);
    await saveWizardDraft(tripId, parsed.data.currentStep, draft);

    return NextResponse.json({ ok: true });
  } catch (err) {
    return hostApiError(err);
  }
}
