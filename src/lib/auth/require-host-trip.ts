import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { hostAccounts, hostTripMembers, trips } from "@/lib/db/schema";
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

export type HostTripMembership = {
  hostId: string;
  tripId: string;
  canEdit: boolean;
  role: "teacher" | "helper" | "host" | "admin";
};

async function loadMembership(
  inviteCode: string,
  hostId: string,
): Promise<(HostTrip & HostTripMembership) | null> {
  return db
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
      hostId: hostTripMembers.hostId,
      tripId: hostTripMembers.tripId,
      canEdit: hostTripMembers.canEdit,
      role: hostAccounts.role,
    })
    .from(trips)
    .innerJoin(hostTripMembers, eq(hostTripMembers.tripId, trips.id))
    .innerJoin(hostAccounts, eq(hostAccounts.id, hostTripMembers.hostId))
    .where(and(eq(trips.inviteCode, inviteCode), eq(hostTripMembers.hostId, hostId)))
    .limit(1)
    .then((rows) => rows[0] ?? null);
}

export async function requireHostTripForInvite(
  inviteCode: string,
): Promise<HostTrip & HostTripMembership> {
  const hostId = await requireHostSessionHostId();
  const row = await loadMembership(inviteCode, hostId);
  if (!row) throw new Error("Unauthorized");
  return row;
}

export async function requireHostTripEditAccess(
  inviteCode: string,
): Promise<HostTrip & HostTripMembership> {
  const membership = await requireHostTripForInvite(inviteCode);
  if (!membership.canEdit) {
    throw new Error("Forbidden");
  }
  return membership;
}

export async function getHostTripMembershipIfAny(
  inviteCode: string,
): Promise<(HostTrip & HostTripMembership) | null> {
  try {
    const hostId = await requireHostSessionHostId();
    return loadMembership(inviteCode, hostId);
  } catch {
    return null;
  }
}
