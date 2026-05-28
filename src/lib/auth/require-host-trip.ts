import { eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { trips } from "@/lib/db/schema";
import { requireHostSessionTripId } from "@/lib/auth/host-session";

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
  const tripId = await requireHostSessionTripId();

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
    .where(eq(trips.id, tripId))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (!trip || trip.inviteCode !== inviteCode) {
    throw new Error("Unauthorized");
  }

  return trip;
}
