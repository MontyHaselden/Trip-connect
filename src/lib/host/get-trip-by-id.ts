import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { hostTripMembers, trips } from "@/lib/db/schema";

export async function getTripByIdForHost(hostId: string, tripId: string) {
  const row = await db
    .select({
      id: trips.id,
      inviteCode: trips.inviteCode,
      viewerCode: trips.viewerCode,
      name: trips.name,
      schoolName: trips.schoolName,
      startDate: trips.startDate,
      endDate: trips.endDate,
      timezone: trips.timezone,
      defaultCountryCallingCode: trips.defaultCountryCallingCode,
      destinationCountry: trips.destinationCountry,
      destinationLanguage: trips.destinationLanguage,
      publishedVersion: trips.publishedVersion,
      viewerGalleryEnabled: trips.viewerGalleryEnabled,
      viewerRoomDetailsEnabled: trips.viewerRoomDetailsEnabled,
      studentGalleryEnabled: trips.studentGalleryEnabled,
    })
    .from(trips)
    .innerJoin(hostTripMembers, eq(hostTripMembers.tripId, trips.id))
    .where(and(eq(trips.id, tripId), eq(hostTripMembers.hostId, hostId)))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  return row;
}

export async function getTripByInviteCode(inviteCode: string) {
  return db
    .select({ id: trips.id, inviteCode: trips.inviteCode })
    .from(trips)
    .where(eq(trips.inviteCode, inviteCode))
    .limit(1)
    .then((rows) => rows[0] ?? null);
}

export async function getTripByViewerCode(viewerCode: string) {
  return db
    .select({
      id: trips.id,
      viewerCode: trips.viewerCode,
      name: trips.name,
      viewerGalleryEnabled: trips.viewerGalleryEnabled,
      viewerRoomDetailsEnabled: trips.viewerRoomDetailsEnabled,
    })
    .from(trips)
    .where(eq(trips.viewerCode, viewerCode))
    .limit(1)
    .then((rows) => rows[0] ?? null);
}
