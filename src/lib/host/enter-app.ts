import { and, eq } from "drizzle-orm";

import { setHostSessionCookie } from "@/lib/auth/host-session";
import { requireHostTripForInvite } from "@/lib/auth/require-host-trip";
import { db } from "@/lib/db/client";
import { hostAccounts, participants } from "@/lib/db/schema";
import { generateAccessToken } from "@/lib/utils/tokens";

function mapHostRoleToParticipantRole(
  role: "teacher" | "helper" | "host" | "admin",
): "teacher" | "helper" | "host" {
  if (role === "admin") return "host";
  return role;
}

export async function ensureHostParticipantForTrip(params: {
  hostId: string;
  tripId: string;
}) {
  const host = await db
    .select({
      id: hostAccounts.id,
      fullName: hostAccounts.fullName,
      phoneNumberE164: hostAccounts.phoneNumberE164,
      role: hostAccounts.role,
      linkedParticipantId: hostAccounts.linkedParticipantId,
    })
    .from(hostAccounts)
    .where(eq(hostAccounts.id, params.hostId))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (!host) throw new Error("Host account not found.");

  if (host.linkedParticipantId) {
    const linked = await db
      .select({
        id: participants.id,
        accessToken: participants.accessToken,
        tripId: participants.tripId,
      })
      .from(participants)
      .where(eq(participants.id, host.linkedParticipantId))
      .limit(1)
      .then((rows) => rows[0] ?? null);

    if (linked && linked.tripId === params.tripId) {
      return linked;
    }
  }

  const existing = await db
    .select({
      id: participants.id,
      accessToken: participants.accessToken,
    })
    .from(participants)
    .where(
      and(
        eq(participants.tripId, params.tripId),
        eq(participants.phoneNumberE164, host.phoneNumberE164),
      ),
    )
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (existing) {
    await db
      .update(hostAccounts)
      .set({ linkedParticipantId: existing.id, updatedAt: new Date() })
      .where(eq(hostAccounts.id, host.id));
    return existing;
  }

  const token = generateAccessToken();
  const [created] = await db
    .insert(participants)
    .values({
      tripId: params.tripId,
      fullName: host.fullName,
      phoneNumberE164: host.phoneNumberE164,
      role: mapHostRoleToParticipantRole(host.role),
      accessToken: token,
    })
    .returning({
      id: participants.id,
      accessToken: participants.accessToken,
    });

  if (!created) throw new Error("Failed to create participant for host.");

  await db
    .update(hostAccounts)
    .set({ linkedParticipantId: created.id, updatedAt: new Date() })
    .where(eq(hostAccounts.id, host.id));

  return created;
}

export async function enterTripApp(inviteCode: string) {
  const membership = await requireHostTripForInvite(inviteCode);
  const participant = await ensureHostParticipantForTrip({
    hostId: membership.hostId,
    tripId: membership.tripId,
  });

  await setHostSessionCookie({
    hostId: membership.hostId,
    activeTripId: membership.tripId,
  });

  return {
    tripId: membership.id,
    inviteCode: membership.inviteCode,
    tripName: membership.name,
    schoolName: membership.schoolName,
    startDate: membership.startDate,
    endDate: membership.endDate,
    timezone: membership.timezone,
    publishedVersion: membership.publishedVersion,
    participantId: participant.id,
    accessToken: participant.accessToken,
    canEdit: membership.canEdit,
    role: membership.role,
  };
}
