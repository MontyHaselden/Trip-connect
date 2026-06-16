import { eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { groupInviteLinks, trips } from "@/lib/db/schema";

export type ResolvedInviteCode =
  | { kind: "trip"; tripId: string; tripName: string; publishedVersion: number; defaultCountryCallingCode: string | null }
  | {
      kind: "group";
      tripId: string;
      tripName: string;
      publishedVersion: number;
      defaultCountryCallingCode: string | null;
      groupInviteLinkId: string;
      groupId: string;
      inviteCode: string;
    };

export async function resolveInviteCode(
  inviteCode: string,
): Promise<ResolvedInviteCode | null> {
  const normalized = inviteCode.trim().toLowerCase();

  const trip = await db
    .select({
      id: trips.id,
      name: trips.name,
      publishedVersion: trips.publishedVersion,
      defaultCountryCallingCode: trips.defaultCountryCallingCode,
    })
    .from(trips)
    .where(eq(trips.inviteCode, normalized))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (trip) {
    return {
      kind: "trip",
      tripId: trip.id,
      tripName: trip.name,
      publishedVersion: trip.publishedVersion,
      defaultCountryCallingCode: trip.defaultCountryCallingCode,
    };
  }

  const groupLink = await db
    .select({
      id: groupInviteLinks.id,
      inviteCode: groupInviteLinks.inviteCode,
      groupId: groupInviteLinks.groupId,
      isActive: groupInviteLinks.isActive,
      tripId: groupInviteLinks.tripId,
      tripName: trips.name,
      publishedVersion: trips.publishedVersion,
      defaultCountryCallingCode: trips.defaultCountryCallingCode,
    })
    .from(groupInviteLinks)
    .innerJoin(trips, eq(groupInviteLinks.tripId, trips.id))
    .where(eq(groupInviteLinks.inviteCode, normalized))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (!groupLink || !groupLink.isActive) return null;

  return {
    kind: "group",
    tripId: groupLink.tripId,
    tripName: groupLink.tripName,
    publishedVersion: groupLink.publishedVersion,
    defaultCountryCallingCode: groupLink.defaultCountryCallingCode,
    groupInviteLinkId: groupLink.id,
    groupId: groupLink.groupId,
    inviteCode: groupLink.inviteCode,
  };
}

/** Trip invite code for a group link (students still authenticate against the trip). */
export async function tripInviteCodeForTripId(tripId: string): Promise<string | null> {
  const row = await db
    .select({ inviteCode: trips.inviteCode })
    .from(trips)
    .where(eq(trips.id, tripId))
    .limit(1)
    .then((rows) => rows[0] ?? null);
  return row?.inviteCode ?? null;
}
