import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";

import { requireHostSessionHostId } from "@/lib/auth/host-session";
import { db } from "@/lib/db/client";
import { groups } from "@/lib/db/schema";
import { hostApiError } from "@/lib/host/api-errors";
import { getTripByIdForHost } from "@/lib/host/get-trip-by-id";

const CreateGroupSchema = z.object({
  name: z.string().trim().min(1).max(120),
  type: z.enum([
    "split_travel",
    "activity",
    "accommodation",
    "staff_helper",
    "other",
    "bus",
    "week",
    "route",
  ]),
  description: z.string().trim().max(500).nullable().optional(),
});

export async function POST(
  req: Request,
  ctx: { params: Promise<{ tripId: string }> },
) {
  const { tripId } = await ctx.params;
  try {
    const hostId = await requireHostSessionHostId();
    const trip = await getTripByIdForHost(hostId, tripId);
    if (!trip) return NextResponse.json({ error: "Trip not found." }, { status: 404 });

    const json = await req.json().catch(() => null);
    const parsed = CreateGroupSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid group data." }, { status: 400 });
    }

    const maxSort = await db
      .select({ sortOrder: groups.sortOrder })
      .from(groups)
      .where(eq(groups.tripId, tripId))
      .orderBy(asc(groups.sortOrder))
      .then((rows) => rows[rows.length - 1]?.sortOrder ?? 0);

    const [created] = await db
      .insert(groups)
      .values({
        tripId,
        name: parsed.data.name,
        type: parsed.data.type,
        description: parsed.data.description ?? null,
        sortOrder: maxSort + 1,
        isMain: false,
      })
      .returning({
        id: groups.id,
        name: groups.name,
        type: groups.type,
        description: groups.description,
        sortOrder: groups.sortOrder,
        isMain: groups.isMain,
      });

    return NextResponse.json({ group: created });
  } catch (err) {
    return hostApiError(err);
  }
}
