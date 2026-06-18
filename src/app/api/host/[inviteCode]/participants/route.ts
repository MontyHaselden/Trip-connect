import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/lib/db/client";
import { participants } from "@/lib/db/schema";
import { requireHostTripEditAccess } from "@/lib/auth/require-host-trip";
import { hostApiError } from "@/lib/host/api-errors";
import { normalizeToE164 } from "@/lib/utils/phone";
import { generateAccessToken } from "@/lib/utils/tokens";
import {
  getRoomForTrip,
  setParticipantGroups,
  setParticipantRoom,
} from "@/lib/host/roster-queries";
import { scheduleAutoPublish } from "@/lib/publish/maybe-auto-publish";
import { generatePlaceholderPhone } from "@/lib/participants/roster-phone";

const CreateParticipantSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  phoneNumber: z.string().trim().min(3).max(40).optional(),
  role: z.enum(["student", "helper", "teacher", "host"]).default("student"),
  roomId: z.string().uuid().nullable().optional(),
  groupIds: z.array(z.string().uuid()).optional(),
});

export async function POST(
  req: Request,
  ctx: { params: Promise<{ inviteCode: string }> },
) {
  const { inviteCode } = await ctx.params;
  try {
    const trip = await requireHostTripEditAccess(inviteCode);
    const json = await req.json().catch(() => null);
    const parsed = CreateParticipantSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }

    const phoneE164 = parsed.data.phoneNumber
      ? normalizeToE164(parsed.data.phoneNumber, trip.defaultCountryCallingCode)
      : generatePlaceholderPhone();

    const existing = await db
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
    if (existing) {
      return NextResponse.json(
        { error: "A participant with this phone number already exists." },
        { status: 400 },
      );
    }

    if (parsed.data.roomId) {
      const room = await getRoomForTrip(trip.id, parsed.data.roomId);
      if (!room) {
        return NextResponse.json({ error: "Invalid room." }, { status: 400 });
      }
    }

    const [created] = await db
      .insert(participants)
      .values({
        tripId: trip.id,
        fullName: parsed.data.fullName,
        phoneNumberE164: phoneE164,
        role: parsed.data.role,
        accessToken: generateAccessToken(),
      })
      .returning();

    if (!created) {
      return NextResponse.json({ error: "Create failed." }, { status: 500 });
    }

    if (parsed.data.roomId) {
      await setParticipantRoom(created.id, parsed.data.roomId);
    }
    if (parsed.data.groupIds?.length) {
      await setParticipantGroups(created.id, parsed.data.groupIds);
    }

    scheduleAutoPublish(trip.id);
    return NextResponse.json({
      id: created.id,
      fullName: created.fullName,
      phoneNumberE164: created.phoneNumberE164,
      role: created.role,
      hasPassword: false,
      roomId: parsed.data.roomId ?? null,
      groupIds: parsed.data.groupIds ?? [],
    });
  } catch (err) {
    return hostApiError(err);
  }
}
