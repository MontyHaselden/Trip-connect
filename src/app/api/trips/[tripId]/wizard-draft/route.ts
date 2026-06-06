import { NextResponse } from "next/server";
import { z } from "zod";

import { requireHostSessionHostId } from "@/lib/auth/host-session";
import { hostApiError } from "@/lib/host/api-errors";
import {
  assertHostTripAccess,
  ensureWizardDraft,
  getWizardDraft,
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

    const row = await getWizardDraft(tripId);
    if (!row) {
      return NextResponse.json({ error: "Wizard draft not found." }, { status: 404 });
    }

    return NextResponse.json(row);
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
