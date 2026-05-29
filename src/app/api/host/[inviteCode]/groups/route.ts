import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db/client";
import { groups } from "@/lib/db/schema";
import { requireHostTripEditAccess } from "@/lib/auth/require-host-trip";
import { hostApiError } from "@/lib/host/api-errors";
import { nextGroupSortOrder } from "@/lib/host/roster-queries";
import { maybeAutoPublish } from "@/lib/publish/maybe-auto-publish";

const CreateGroupSchema = z.object({
  name: z.string().trim().min(1).max(200),
  type: z.enum(["activity", "bus", "week", "other"]),
  description: z.string().trim().max(500).nullable().optional(),
});

export async function POST(
  req: Request,
  ctx: { params: Promise<{ inviteCode: string }> },
) {
  const { inviteCode } = await ctx.params;
  try {
    const trip = await requireHostTripEditAccess(inviteCode);
    const json = await req.json().catch(() => null);
    const parsed = CreateGroupSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }

    const sortOrder = await nextGroupSortOrder(trip.id);
    const [created] = await db
      .insert(groups)
      .values({
        tripId: trip.id,
        name: parsed.data.name,
        type: parsed.data.type,
        description: parsed.data.description ?? null,
        sortOrder,
      })
      .returning();

    await maybeAutoPublish(trip.id);
    return NextResponse.json(created);
  } catch (err) {
    return hostApiError(err);
  }
}
