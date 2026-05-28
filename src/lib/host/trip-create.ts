import { randomBytes } from "crypto";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { hostTripMembers, trips } from "@/lib/db/schema";

function randomInvite(len: number) {
  return randomBytes(Math.ceil(len / 2))
    .toString("hex")
    .slice(0, len);
}

async function uniqueInviteCode(): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const candidate = randomInvite(6);
    const exists = await db
      .select({ id: trips.id })
      .from(trips)
      .where(eq(trips.inviteCode, candidate))
      .limit(1)
      .then((rows) => rows[0] ?? null);
    if (!exists) return candidate;
  }
  throw new Error("Could not generate invite code.");
}

export async function createTripForHost(params: {
  hostId: string;
  name: string;
  schoolName: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  timezone: string;
  defaultCountryCallingCode: string; // e.g. NZ
}) {
  const inviteCode = await uniqueInviteCode();

  const [trip] = await db
    .insert(trips)
    .values({
      name: params.name.trim(),
      schoolName: params.schoolName.trim(),
      inviteCode,
      hostCodeHash: null,
      startDate: params.startDate,
      endDate: params.endDate,
      timezone: params.timezone.trim(),
      defaultCountryCallingCode: params.defaultCountryCallingCode.trim().toUpperCase(),
      publishedVersion: 0,
    })
    .returning({ id: trips.id, inviteCode: trips.inviteCode });

  if (!trip) throw new Error("Failed to create trip.");

  await db.insert(hostTripMembers).values({ hostId: params.hostId, tripId: trip.id });

  return trip;
}

