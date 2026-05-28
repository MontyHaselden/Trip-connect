import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { hostTripMembers, trips } from "@/lib/db/schema";
import { requireHostSessionHostId } from "@/lib/auth/host-session";

export type HostTrip = {
  id: string;
  name: string;
  schoolName: string;
  inviteCode: string;
  startDate: string;
  endDate: string;
  destinationCountry: string | null;
  destinationLanguage: string | null;
  timezone: string;
  defaultCountryCallingCode: string;
  publishedVersion: number;
  updatedAt: Date;
};

export async function requireHostTripForInvite(
  inviteCode: string,
): Promise<HostTrip> {
  const hostId = await requireHostSessionHostId();

  const trip = await db
    .select({
      id: trips.id,
      name: trips.name,
      schoolName: trips.schoolName,
      inviteCode: trips.inviteCode,
      startDate: trips.startDate,
      endDate: trips.endDate,
      destinationCountry: trips.destinationCountry,
      destinationLanguage: trips.destinationLanguage,
      timezone: trips.timezone,
      defaultCountryCallingCode: trips.defaultCountryCallingCode,
      publishedVersion: trips.publishedVersion,
      updatedAt: trips.updatedAt,
    })
    .from(trips)
    .innerJoin(hostTripMembers, eq(hostTripMembers.tripId, trips.id))
    .where(
      and(eq(trips.inviteCode, inviteCode), eq(hostTripMembers.hostId, hostId)),
    )
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (!trip) {
    throw new Error("Unauthorized");
  }

  return trip;
}
