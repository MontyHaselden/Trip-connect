import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { participants } from "@/lib/db/schema";
import { resolveInviteCode } from "@/lib/join/resolve-invite-code";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ inviteCode: string }> },
) {
  try {
    const { inviteCode } = await ctx.params;
    const resolved = await resolveInviteCode(inviteCode);
    if (!resolved) {
      return NextResponse.json({ error: "Trip not found." }, { status: 404 });
    }

    const rows = await db
      .select({
        id: participants.id,
        fullName: participants.fullName,
        role: participants.role,
        passwordHash: participants.passwordHash,
      })
      .from(participants)
      .where(eq(participants.tripId, resolved.tripId))
      .orderBy(asc(participants.fullName));

    const people = rows
      .filter((p) => p.role !== "host")
      .map((p) => ({
        id: p.id,
        fullName: p.fullName,
        role: p.role,
        hasJoined: Boolean(p.passwordHash),
      }));

    return NextResponse.json({
      tripName: resolved.tripName,
      people,
      available: people.filter((p) => !p.hasJoined),
      joined: people.filter((p) => p.hasJoined),
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unexpected error. Please try again.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
