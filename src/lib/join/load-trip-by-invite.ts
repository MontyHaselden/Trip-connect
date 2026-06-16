import { eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { groupInviteLinks, trips } from "@/lib/db/schema";

export type LoadedStudentTrip = {
  id: string;
  name: string;
  /** Canonical trip invite code for session storage. */
  tripInviteCode: string;
  /** Code used in the URL (may be a group link code). */
  urlInviteCode: string;
  groupId: string | null;
};

export async function loadTripByAnyInviteCode(
  urlInviteCode: string,
): Promise<LoadedStudentTrip | null> {
  const normalized = urlInviteCode.trim().toLowerCase();

  const trip = await db
    .select({ id: trips.id, name: trips.name, inviteCode: trips.inviteCode })
    .from(trips)
    .where(eq(trips.inviteCode, normalized))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (trip) {
    return {
      id: trip.id,
      name: trip.name,
      tripInviteCode: trip.inviteCode,
      urlInviteCode: normalized,
      groupId: null,
    };
  }

  const groupLink = await db
    .select({
      groupId: groupInviteLinks.groupId,
      isActive: groupInviteLinks.isActive,
      tripId: trips.id,
      tripName: trips.name,
      tripInviteCode: trips.inviteCode,
    })
    .from(groupInviteLinks)
    .innerJoin(trips, eq(groupInviteLinks.tripId, trips.id))
    .where(eq(groupInviteLinks.inviteCode, normalized))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (!groupLink || !groupLink.isActive) return null;

  return {
    id: groupLink.tripId,
    name: groupLink.tripName,
    tripInviteCode: groupLink.tripInviteCode,
    urlInviteCode: normalized,
    groupId: groupLink.groupId,
  };
}
