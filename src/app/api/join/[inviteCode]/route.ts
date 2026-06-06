import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/lib/db/client";
import { participants, trips } from "@/lib/db/schema";
import {
  hashParticipantPassword,
  verifyParticipantPassword,
} from "@/lib/participants/password";
import { ensureTripPublishedIfReady } from "@/lib/publish/ensure-published";
import { normalizeToE164 } from "@/lib/utils/phone";
import { generateAccessToken } from "@/lib/utils/tokens";

const JoinBodySchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  phoneNumber: z.string().trim().min(3).max(40),
  password: z.string().min(8).max(200).optional(),
});

export async function POST(
  req: Request,
  ctx: { params: Promise<{ inviteCode: string }> },
) {
  try {
    const { inviteCode } = await ctx.params;
    const json = await req.json().catch(() => null);
    const parsed = JoinBodySchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request." },
        { status: 400 },
      );
    }

    const { fullName, phoneNumber, password } = parsed.data;

    const trip = await db
      .select({
        id: trips.id,
        name: trips.name,
        publishedVersion: trips.publishedVersion,
        defaultCountryCallingCode: trips.defaultCountryCallingCode,
      })
      .from(trips)
      .where(eq(trips.inviteCode, inviteCode))
      .limit(1)
      .then((rows) => rows[0] ?? null);

    if (!trip) {
      return NextResponse.json({ error: "Trip not found." }, { status: 404 });
    }

    const phoneE164 = normalizeToE164(phoneNumber, trip.defaultCountryCallingCode);

    const existing = await db
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

    if (existing) {
      if (existing.passwordHash) {
        if (!password) {
          return NextResponse.json(
            { error: "This phone number is already registered. Sign in with your password." },
            { status: 409 },
          );
        }
        const ok = await verifyParticipantPassword(password, existing.passwordHash);
        if (!ok) {
          return NextResponse.json({ error: "Incorrect password." }, { status: 401 });
        }
      } else if (password) {
        await db
          .update(participants)
          .set({
            passwordHash: await hashParticipantPassword(password),
            updatedAt: new Date(),
          })
          .where(eq(participants.id, existing.id));
      }

      const publishedVersion = await ensureTripPublishedIfReady(trip.id);
      return NextResponse.json({
        tripId: trip.id,
        participantId: existing.id,
        accessToken: existing.accessToken,
        tripName: trip.name,
        publishedVersion,
      });
    }

    const token = generateAccessToken();
    const passwordHash = password
      ? await hashParticipantPassword(password)
      : null;

    const created = await db
      .insert(participants)
      .values({
        tripId: trip.id,
        fullName,
        phoneNumberE164: phoneE164,
        role: "student",
        accessToken: token,
        passwordHash,
      })
      .returning({ id: participants.id, accessToken: participants.accessToken })
      .then((rows) => rows[0] ?? null);

    if (!created) {
      return NextResponse.json({ error: "Join failed." }, { status: 500 });
    }

    const publishedVersion = await ensureTripPublishedIfReady(trip.id);

    return NextResponse.json({
      tripId: trip.id,
      participantId: created.id,
      accessToken: created.accessToken,
      tripName: trip.name,
      publishedVersion,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unexpected error. Please try again.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
