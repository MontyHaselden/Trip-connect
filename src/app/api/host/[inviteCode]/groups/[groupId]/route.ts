import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/lib/db/client";
import { groups } from "@/lib/db/schema";
import { requireHostTripEditAccess } from "@/lib/auth/require-host-trip";
import { hostApiError } from "@/lib/host/api-errors";
import { getGroupForTrip } from "@/lib/host/roster-queries";
import { maybeAutoPublish } from "@/lib/publish/maybe-auto-publish";

const PatchGroupSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  type: z.enum(["activity", "bus", "week", "other"]).optional(),
  description: z.string().trim().max(500).nullable().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ inviteCode: string; groupId: string }> },
) {
  const { inviteCode, groupId } = await ctx.params;
  try {
    const trip = await requireHostTripEditAccess(inviteCode);
    const group = await getGroupForTrip(trip.id, groupId);
    if (!group) return NextResponse.json({ error: "Group not found." }, { status: 404 });

    const json = await req.json().catch(() => null);
    const parsed = PatchGroupSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }

    const [updated] = await db
      .update(groups)
      .set({
        name: parsed.data.name ?? group.name,
        type: parsed.data.type ?? group.type,
        description:
          parsed.data.description !== undefined
            ? parsed.data.description
            : group.description,
        sortOrder: parsed.data.sortOrder ?? group.sortOrder,
      })
      .where(eq(groups.id, groupId))
      .returning();

    await maybeAutoPublish(trip.id);
    return NextResponse.json(updated);
  } catch (err) {
    return hostApiError(err);
  }
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ inviteCode: string; groupId: string }> },
) {
  const { inviteCode, groupId } = await ctx.params;
  try {
    const trip = await requireHostTripEditAccess(inviteCode);
    const group = await getGroupForTrip(trip.id, groupId);
    if (!group) return NextResponse.json({ error: "Group not found." }, { status: 404 });

    await db.delete(groups).where(eq(groups.id, groupId));
    await maybeAutoPublish(trip.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return hostApiError(err);
  }
}
