import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { z } from "zod";

import { db } from "@/lib/db/client";
import { trips } from "@/lib/db/schema";
import { setHostSessionCookie } from "@/lib/auth/host-session";

const BodySchema = z.object({
  hostCode: z.string().trim().min(1).max(100),
});

export async function POST(
  req: Request,
  ctx: { params: Promise<{ inviteCode: string }> },
) {
  const { inviteCode } = await ctx.params;
  const json = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const trip = await db
    .select({ id: trips.id, hostCodeHash: trips.hostCodeHash })
    .from(trips)
    .where(eq(trips.inviteCode, inviteCode))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (!trip) {
    return NextResponse.json({ error: "Trip not found." }, { status: 404 });
  }

  const ok = await bcrypt.compare(parsed.data.hostCode, trip.hostCodeHash);
  if (!ok) {
    return NextResponse.json({ error: "Invalid host code." }, { status: 401 });
  }

  await setHostSessionCookie(trip.id);
  return NextResponse.json({ ok: true, tripId: trip.id });
}

