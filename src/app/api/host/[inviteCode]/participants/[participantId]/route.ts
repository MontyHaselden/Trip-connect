import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/lib/db/client";
import { participants } from "@/lib/db/schema";
import { requireHostTripEditAccess } from "@/lib/auth/require-host-trip";
import { hostApiError } from "@/lib/host/api-errors";
import { normalizeToE164 } from "@/lib/utils/phone";
import {
  getParticipantForTrip,
  getRoomForTrip,
  loadRoster,
  setParticipantGroups,
  setParticipantRoom,
} from "@/lib/host/roster-queries";
import { maybeAutoPublish } from "@/lib/publish/maybe-auto-publish";

const PatchParticipantSchema = z.object({
  fullName: z.string().trim().min(2).max(120).optional(),
  phoneNumber: z.string().trim().min(3).max(40).optional(),
  role: z.enum(["student", "helper", "teacher", "host"]).optional(),
  roomId: z.string().uuid().nullable().optional(),
  groupIds: z.array(z.string().uuid()).optional(),
  inCostSplit: z.boolean().optional(),
});

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ inviteCode: string; participantId: string }> },
) {
  const { inviteCode, participantId } = await ctx.params;
  try {
    const trip = await requireHostTripEditAccess(inviteCode);
    const existing = await getParticipantForTrip(trip.id, participantId);
    if (!existing) {
      return NextResponse.json({ error: "Participant not found." }, { status: 404 });
    }

    const json = await req.json().catch(() => null);
    const parsed = PatchParticipantSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }

    let phoneE164 = existing.phoneNumberE164;
    if (parsed.data.phoneNumber) {
      phoneE164 = normalizeToE164(
        parsed.data.phoneNumber,
        trip.defaultCountryCallingCode,
      );
      const dup = await db
        .select({ id: participants.id })
        .from(participants)
        .where(
          and(
            eq(participants.tripId, trip.id),
            eq(participants.phoneNumberE164, phoneE164),
          ),
        )
        .limit(1)
        .then((rows) => rows[0]);
      if (dup && dup.id !== participantId) {
        return NextResponse.json(
          { error: "Another participant uses this phone number." },
          { status: 400 },
        );
      }
    }

    if (parsed.data.roomId) {
      const room = await getRoomForTrip(trip.id, parsed.data.roomId);
      if (!room) {
        return NextResponse.json({ error: "Invalid room." }, { status: 400 });
      }
    }

    await db
      .update(participants)
      .set({
        fullName: parsed.data.fullName ?? existing.fullName,
        phoneNumberE164: phoneE164,
        role: parsed.data.role ?? existing.role,
        inCostSplit: parsed.data.inCostSplit ?? existing.inCostSplit,
        updatedAt: new Date(),
      })
      .where(eq(participants.id, participantId));

    if (parsed.data.roomId !== undefined) {
      await setParticipantRoom(participantId, parsed.data.roomId);
    }
    if (parsed.data.groupIds !== undefined) {
      await setParticipantGroups(participantId, parsed.data.groupIds);
    }

    const roster = await loadRoster(trip.id);
    const p = roster.participants.find((x) => x.id === participantId);
    await maybeAutoPublish(trip.id);
    return NextResponse.json(p);
  } catch (err) {
    return hostApiError(err);
  }
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ inviteCode: string; participantId: string }> },
) {
  const { inviteCode, participantId } = await ctx.params;
  try {
    const trip = await requireHostTripEditAccess(inviteCode);
    const existing = await getParticipantForTrip(trip.id, participantId);
    if (!existing) {
      return NextResponse.json({ error: "Participant not found." }, { status: 404 });
    }

    await db.delete(participants).where(eq(participants.id, participantId));
    await maybeAutoPublish(trip.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return hostApiError(err);
  }
}
