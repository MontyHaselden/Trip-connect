import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { hostTripMembers, trips } from "@/lib/db/schema";
import { getTripDeleteStatus } from "@/lib/host/trip-delete-eligibility";

export async function deleteTripForHost(hostId: string, tripId: string) {
  const trip = await db
    .select({
      id: trips.id,
      startDate: trips.startDate,
      endDate: trips.endDate,
      timezone: trips.timezone,
      publishedVersion: trips.publishedVersion,
    })
    .from(trips)
    .innerJoin(hostTripMembers, eq(hostTripMembers.tripId, trips.id))
    .where(and(eq(trips.id, tripId), eq(hostTripMembers.hostId, hostId)))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (!trip) {
    return { ok: false as const, status: 404, error: "Trip not found." };
  }

  const deleteStatus = await getTripDeleteStatus(trip);
  if (!deleteStatus.canDelete) {
    return {
      ok: false as const,
      status: 409,
      error: deleteStatus.reason ?? "This trip cannot be deleted.",
    };
  }

  await db.delete(trips).where(eq(trips.id, tripId));
  return { ok: true as const };
}
