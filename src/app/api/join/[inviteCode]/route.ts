import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/lib/db/client";
import { participantGroups, participants } from "@/lib/db/schema";
import { resolveInviteCode, tripInviteCodeForTripId } from "@/lib/join/resolve-invite-code";
import {
  hashParticipantPassword,
  verifyParticipantPassword,
} from "@/lib/participants/password";
import { ensureTripPublishedIfReady } from "@/lib/publish/ensure-published";
import { normalizeToE164 } from "@/lib/utils/phone";
import { generateAccessToken } from "@/lib/utils/tokens";

const ClaimJoinSchema = z.object({
  participantId: z.string().uuid(),
  password: z.string().min(8).max(200),
});

const LegacyJoinSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  phoneNumber: z.string().trim().min(3).max(40),
  password: z.string().min(8).max(200),
});

const JoinBodySchema = z.union([ClaimJoinSchema, LegacyJoinSchema]);

async function ensureGroupMembership(
  participantId: string,
  groupId: string,
): Promise<void> {
  const existing = await db
    .select({ participantId: participantGroups.participantId })
    .from(participantGroups)
    .where(
      and(
        eq(participantGroups.participantId, participantId),
        eq(participantGroups.groupId, groupId),
      ),
    )
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (!existing) {
    await db.insert(participantGroups).values({ participantId, groupId });
  }
}

async function finishJoin(
  trip: { id: string; name: string },
  participant: { id: string; accessToken: string },
  resolved: Awaited<ReturnType<typeof resolveInviteCode>>,
) {
  const publishedVersion = await ensureTripPublishedIfReady(trip.id);
  const tripInviteCode = await tripInviteCodeForTripId(trip.id);
  return NextResponse.json({
    tripId: trip.id,
    participantId: participant.id,
    accessToken: participant.accessToken,
    tripName: trip.name,
    publishedVersion,
    tripInviteCode,
    joinedGroupId: resolved?.kind === "group" ? resolved.groupId : null,
  });
}

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

    const resolved = await resolveInviteCode(inviteCode);
    if (!resolved) {
      return NextResponse.json({ error: "Trip not found." }, { status: 404 });
    }

    const trip = {
      id: resolved.tripId,
      name: resolved.tripName,
      publishedVersion: resolved.publishedVersion,
      defaultCountryCallingCode: resolved.defaultCountryCallingCode,
    };

    if ("participantId" in parsed.data) {
      const { participantId, password } = parsed.data;

      const slot = await db
        .select({
          id: participants.id,
          accessToken: participants.accessToken,
          passwordHash: participants.passwordHash,
          role: participants.role,
        })
        .from(participants)
        .where(
          and(eq(participants.tripId, trip.id), eq(participants.id, participantId)),
        )
        .limit(1)
        .then((rows) => rows[0] ?? null);

      if (!slot) {
        return NextResponse.json({ error: "Name not found on this trip." }, { status: 404 });
      }

      if (slot.role === "host") {
        return NextResponse.json({ error: "Invalid account." }, { status: 400 });
      }

      if (slot.passwordHash) {
        return NextResponse.json(
          { error: "This name is already taken. Use Sign in instead." },
          { status: 409 },
        );
      }

      await db
        .update(participants)
        .set({
          passwordHash: await hashParticipantPassword(password),
          updatedAt: new Date(),
        })
        .where(eq(participants.id, slot.id));

      if (resolved.kind === "group") {
        await ensureGroupMembership(slot.id, resolved.groupId);
        await db
          .update(participants)
          .set({ joinedViaGroupInviteLinkId: resolved.groupInviteLinkId })
          .where(eq(participants.id, slot.id));
      }

      return finishJoin(trip, slot, resolved);
    }

    const { fullName, phoneNumber, password } = parsed.data;

    const phoneE164 = normalizeToE164(
      phoneNumber,
      trip.defaultCountryCallingCode ?? "+64",
    );

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

      if (resolved.kind === "group") {
        await ensureGroupMembership(existing.id, resolved.groupId);
        await db
          .update(participants)
          .set({ joinedViaGroupInviteLinkId: resolved.groupInviteLinkId })
          .where(eq(participants.id, existing.id));
      }

      return finishJoin(trip, existing, resolved);
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
        joinedViaGroupInviteLinkId:
          resolved.kind === "group" ? resolved.groupInviteLinkId : null,
      })
      .returning({ id: participants.id, accessToken: participants.accessToken })
      .then((rows) => rows[0] ?? null);

    if (!created) {
      return NextResponse.json({ error: "Join failed." }, { status: 500 });
    }

    if (resolved.kind === "group") {
      await ensureGroupMembership(created.id, resolved.groupId);
    }

    return finishJoin(trip, created, resolved);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unexpected error. Please try again.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
