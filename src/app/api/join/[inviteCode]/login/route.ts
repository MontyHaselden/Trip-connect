import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/lib/db/client";
import { participants, trips } from "@/lib/db/schema";
import { verifyParticipantPassword } from "@/lib/participants/password";
import { ensureTripPublishedIfReady } from "@/lib/publish/ensure-published";
import { normalizeToE164 } from "@/lib/utils/phone";

const LoginBodySchema = z.object({
  phoneNumber: z.string().trim().min(3).max(40),
  password: z.string().min(1).max(200),
});

export async function POST(
  req: Request,
  ctx: { params: Promise<{ inviteCode: string }> },
) {
  try {
    const { inviteCode } = await ctx.params;
    const json = await req.json().catch(() => null);
    const parsed = LoginBodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }

    const trip = await db
      .select({
        id: trips.id,
        name: trips.name,
        defaultCountryCallingCode: trips.defaultCountryCallingCode,
      })
      .from(trips)
      .where(eq(trips.inviteCode, inviteCode))
      .limit(1)
      .then((rows) => rows[0] ?? null);

    if (!trip) {
      return NextResponse.json({ error: "Trip not found." }, { status: 404 });
    }

    const phoneE164 = normalizeToE164(
      parsed.data.phoneNumber,
      trip.defaultCountryCallingCode,
    );

    const participant = await db
      .select({
        id: participants.id,
        accessToken: participants.accessToken,
        passwordHash: participants.passwordHash,
      })
      .from(participants)
      .where(
        and(
          eq(participants.tripId, trip.id),
          eq(participants.phoneNumberE164, phoneE164),
        ),
      )
      .limit(1)
      .then((rows) => rows[0] ?? null);

    if (!participant) {
      return NextResponse.json({ error: "No account found for that phone number." }, { status: 404 });
    }

    if (!participant.passwordHash) {
      return NextResponse.json(
        { error: "This account has no password yet. Use Join to set one up." },
        { status: 400 },
      );
    }

    const ok = await verifyParticipantPassword(
      parsed.data.password,
      participant.passwordHash,
    );
    if (!ok) {
      return NextResponse.json({ error: "Incorrect password." }, { status: 401 });
    }

    const publishedVersion = await ensureTripPublishedIfReady(trip.id);

    return NextResponse.json({
      tripId: trip.id,
      participantId: participant.id,
      accessToken: participant.accessToken,
      tripName: trip.name,
      publishedVersion,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unexpected error. Please try again.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
