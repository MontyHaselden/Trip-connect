import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/lib/db/client";
import { groupInviteLinks } from "@/lib/db/schema";
import { requireHostTripEditAccess } from "@/lib/auth/require-host-trip";
import { hostApiError } from "@/lib/host/api-errors";

const PatchLinkSchema = z.object({
  isActive: z.boolean().optional(),
  label: z.string().trim().min(1).max(120).optional(),
});

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ inviteCode: string; groupId: string; linkId: string }> },
) {
  const { inviteCode, groupId, linkId } = await ctx.params;
  try {
    const trip = await requireHostTripEditAccess(inviteCode);
    const json = await req.json().catch(() => null);
    const parsed = PatchLinkSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }

    const link = await db
      .select({ id: groupInviteLinks.id })
      .from(groupInviteLinks)
      .where(
        and(
          eq(groupInviteLinks.id, linkId),
          eq(groupInviteLinks.tripId, trip.id),
          eq(groupInviteLinks.groupId, groupId),
        ),
      )
      .limit(1)
      .then((rows) => rows[0] ?? null);

    if (!link) {
      return NextResponse.json({ error: "Link not found." }, { status: 404 });
    }

    const [updated] = await db
      .update(groupInviteLinks)
      .set(parsed.data)
      .where(eq(groupInviteLinks.id, linkId))
      .returning();

    return NextResponse.json(updated);
  } catch (err) {
    return hostApiError(err);
  }
}
