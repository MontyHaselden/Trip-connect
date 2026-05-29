import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { requireHostTripEditAccess } from "@/lib/auth/require-host-trip";
import { hostApiError } from "@/lib/host/api-errors";
import { db } from "@/lib/db/client";
import { hostTripMembers } from "@/lib/db/schema";

const PatchSchema = z.object({
  canEdit: z.boolean().optional(),
  remove: z.boolean().optional(),
});

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ inviteCode: string; hostId: string }> },
) {
  const { inviteCode, hostId: targetHostId } = await ctx.params;
  try {
    const membership = await requireHostTripEditAccess(inviteCode);
    const json = await req.json().catch(() => null);
    const parsed = PatchSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }

    if (targetHostId === membership.hostId && parsed.data.remove) {
      return NextResponse.json(
        { error: "You cannot remove yourself from the trip." },
        { status: 400 },
      );
    }

    if (parsed.data.remove) {
      await db
        .delete(hostTripMembers)
        .where(
          and(
            eq(hostTripMembers.tripId, membership.id),
            eq(hostTripMembers.hostId, targetHostId),
          ),
        );
      return NextResponse.json({ ok: true });
    }

    if (typeof parsed.data.canEdit === "boolean") {
      await db
        .update(hostTripMembers)
        .set({ canEdit: parsed.data.canEdit })
        .where(
          and(
            eq(hostTripMembers.tripId, membership.id),
            eq(hostTripMembers.hostId, targetHostId),
          ),
        );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return hostApiError(err);
  }
}
