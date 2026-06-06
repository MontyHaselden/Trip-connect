import { NextResponse } from "next/server";

import { requireHostSessionHostId } from "@/lib/auth/host-session";
import { hostApiError } from "@/lib/host/api-errors";
import { assertHostTripAccess, getWizardDraft } from "@/lib/host/wizard/draft-queries";
import { collectWizardWarnings } from "@/lib/host/wizard/review-warnings";

export const runtime = "nodejs";

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
      return NextResponse.json({ warnings: [] });
    }

    const warnings = await collectWizardWarnings(tripId, row.draft);
    return NextResponse.json({ warnings });
  } catch (err) {
    return hostApiError(err);
  }
}
