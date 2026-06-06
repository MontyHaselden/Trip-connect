import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/lib/db/client";
import { trips } from "@/lib/db/schema";
import { requireHostSessionHostId } from "@/lib/auth/host-session";
import { hostApiError } from "@/lib/host/api-errors";
import { getTripByIdForHost } from "@/lib/host/get-trip-by-id";
import { maybeAutoPublish } from "@/lib/publish/maybe-auto-publish";

const BodySchema = z.object({
  name: z.string().trim().min(1).max(200),
  schoolName: z.string().trim().min(1).max(200),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  destinationCountry: z.string().trim().max(100).nullable().optional(),
  destinationLanguage: z.string().trim().max(20).nullable().optional(),
  timezone: z.string().trim().min(1).max(80),
});

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ tripId: string }> },
) {
  const { tripId } = await ctx.params;
  try {
    const hostId = await requireHostSessionHostId();
    const existing = await getTripByIdForHost(hostId, tripId);
    if (!existing) return NextResponse.json({ error: "Trip not found." }, { status: 404 });

    const json = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }
    if (parsed.data.endDate < parsed.data.startDate) {
      return NextResponse.json(
        { error: "End date must be on or after start date." },
        { status: 400 },
      );
    }

    const [updated] = await db
      .update(trips)
      .set({
        name: parsed.data.name,
        schoolName: parsed.data.schoolName,
        startDate: parsed.data.startDate,
        endDate: parsed.data.endDate,
        destinationCountry: parsed.data.destinationCountry ?? null,
        destinationLanguage: parsed.data.destinationLanguage ?? null,
        timezone: parsed.data.timezone,
        updatedAt: new Date(),
      })
      .where(eq(trips.id, tripId))
      .returning();

    if (!updated) return NextResponse.json({ error: "Update failed." }, { status: 500 });

    await maybeAutoPublish(tripId);
    const trip = await getTripByIdForHost(hostId, tripId);
    return NextResponse.json({ trip });
  } catch (err) {
    return hostApiError(err);
  }
}
