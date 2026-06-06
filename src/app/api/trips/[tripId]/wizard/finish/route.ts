import { NextResponse } from "next/server";

import { requireHostSessionHostId } from "@/lib/auth/host-session";
import { hostApiError } from "@/lib/host/api-errors";
import {
  commitWizardActivities,
  commitWizardShell,
} from "@/lib/host/wizard/commit-shell";
import {
  assertHostTripAccess,
  getWizardDraft,
  saveWizardDraft,
} from "@/lib/host/wizard/draft-queries";

export const runtime = "nodejs";

export async function POST(
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

    await commitWizardShell(tripId, row.draft);
    await commitWizardActivities(tripId, row.draft);

    const updated = { ...row.draft, shellCommitted: true };
    await saveWizardDraft(tripId, 8, updated);

    return NextResponse.json({ ok: true, tripId });
  } catch (err) {
    return hostApiError(err);
  }
}
