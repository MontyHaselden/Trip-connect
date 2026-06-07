import { eq, inArray } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { hostTripMembers, trips } from "@/lib/db/schema";

export async function getActiveTripCountForAccount(accountId: string): Promise<number> {
  const rows = await db
    .select({
      endDate: trips.endDate,
      publishedVersion: trips.publishedVersion,
    })
    .from(trips)
    .innerJoin(hostTripMembers, eq(hostTripMembers.tripId, trips.id))
    .where(eq(hostTripMembers.hostId, accountId));

  const today = new Date().toISOString().slice(0, 10);
  return rows.filter((t) => t.endDate >= today || t.publishedVersion === 0).length;
}

export async function getStaffCountForAccount(accountId: string): Promise<number> {
  const ownedTrips = await db
    .select({ tripId: hostTripMembers.tripId })
    .from(hostTripMembers)
    .where(eq(hostTripMembers.hostId, accountId));

  const tripIds = ownedTrips.map((t) => t.tripId);
  if (tripIds.length === 0) return 1;

  const members = await db
    .select({ hostId: hostTripMembers.hostId })
    .from(hostTripMembers)
    .where(inArray(hostTripMembers.tripId, tripIds));

  return new Set(members.map((m) => m.hostId)).size;
}

export async function getTripOwnerAccountId(tripId: string): Promise<string | null> {
  const row = await db
    .select({ hostId: hostTripMembers.hostId })
    .from(hostTripMembers)
    .where(eq(hostTripMembers.tripId, tripId))
    .limit(1)
    .then((rows) => rows[0] ?? null);
  return row?.hostId ?? null;
}
