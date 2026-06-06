import { eq } from "drizzle-orm";

import { setHostSessionCookie } from "@/lib/auth/host-session";
import { db } from "@/lib/db/client";
import { trips } from "@/lib/db/schema";
import { ensureHostParticipantForTrip } from "@/lib/host/enter-app";
import { findValidMobileToken } from "@/lib/mobile/tokens";

export async function exchangeMobileToken(raw: string) {
  const record = await findValidMobileToken(raw);
  if (!record) {
    return { ok: false as const, status: 401, error: "Invalid or expired link." };
  }

  if (record.purpose === "host_admin") {
    if (!record.hostId) {
      return { ok: false as const, status: 400, error: "Invalid admin link." };
    }
    await setHostSessionCookie({
      hostId: record.hostId,
      activeTripId: record.tripId,
    });
    return {
      ok: true as const,
      purpose: "host_admin" as const,
      tripId: record.tripId,
      redirectTo: `/mobile/admin/trip/${record.tripId}`,
    };
  }

  if (record.purpose === "host_trip") {
    if (!record.hostId) {
      return { ok: false as const, status: 400, error: "Invalid trip link." };
    }
    const participant = await ensureHostParticipantForTrip({
      hostId: record.hostId,
      tripId: record.tripId,
    });
    await setHostSessionCookie({
      hostId: record.hostId,
      activeTripId: record.tripId,
    });
    const trip = await db
      .select({ inviteCode: trips.inviteCode })
      .from(trips)
      .where(eq(trips.id, record.tripId))
      .limit(1)
      .then((rows) => rows[0] ?? null);
    return {
      ok: true as const,
      purpose: "host_trip" as const,
      tripId: record.tripId,
      inviteCode: trip?.inviteCode ?? "",
      participantId: participant.id,
      accessToken: participant.accessToken,
      redirectTo: `/trip/${record.tripId}/today`,
    };
  }

  return { ok: false as const, status: 400, error: "Unsupported link type." };
}
