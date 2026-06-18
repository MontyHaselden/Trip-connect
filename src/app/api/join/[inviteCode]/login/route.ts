import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/lib/db/client";
import { participants } from "@/lib/db/schema";
import { resolveInviteCode, tripInviteCodeForTripId } from "@/lib/join/resolve-invite-code";
import { verifyParticipantPassword } from "@/lib/participants/password";
import { ensureTripPublishedIfReady } from "@/lib/publish/ensure-published";
import { normalizeToE164 } from "@/lib/utils/phone";

const ClaimLoginSchema = z.object({
  participantId: z.string().uuid(),
  password: z.string().min(1).max(200),
});

const LegacyLoginSchema = z.object({
  phoneNumber: z.string().trim().min(3).max(40),
  password: z.string().min(1).max(200),
});

const LoginBodySchema = z.union([ClaimLoginSchema, LegacyLoginSchema]);

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

    const resolved = await resolveInviteCode(inviteCode);
    if (!resolved) {
      return NextResponse.json({ error: "Trip not found." }, { status: 404 });
    }

    const trip = {
      id: resolved.tripId,
      name: resolved.tripName,
      defaultCountryCallingCode: resolved.defaultCountryCallingCode,
    };

    let participant: {
      id: string;
      accessToken: string;
      passwordHash: string | null;
    } | null = null;

    if ("participantId" in parsed.data) {
      participant = await db
        .select({
          id: participants.id,
          accessToken: participants.accessToken,
          passwordHash: participants.passwordHash,
        })
        .from(participants)
        .where(
          and(
            eq(participants.tripId, trip.id),
            eq(participants.id, parsed.data.participantId),
          ),
        )
        .limit(1)
        .then((rows) => rows[0] ?? null);
    } else {
      const phoneE164 = normalizeToE164(
        parsed.data.phoneNumber,
        trip.defaultCountryCallingCode ?? "+64",
      );

      participant = await db
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
    }

    if (!participant) {
      return NextResponse.json({ error: "Account not found." }, { status: 404 });
    }

    if (!participant.passwordHash) {
      return NextResponse.json(
        { error: "You haven't joined yet. Use Join to set your password." },
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
    const tripInviteCode = await tripInviteCodeForTripId(trip.id);

    return NextResponse.json({
      tripId: trip.id,
      participantId: participant.id,
      accessToken: participant.accessToken,
      tripName: trip.name,
      publishedVersion,
      tripInviteCode,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unexpected error. Please try again.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
