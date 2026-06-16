import { randomBytes } from "crypto";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { hostTripMembers, trips } from "@/lib/db/schema";
import { ensureMainGroupForTrip } from "@/lib/groups/main-group";
import { unsetTripDateRange } from "@/lib/host/trip-dates";

function randomInvite(len: number) {
  return randomBytes(Math.ceil(len / 2))
    .toString("hex")
    .slice(0, len);
}

async function uniqueTripCode(column: "inviteCode" | "viewerCode"): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const candidate = randomInvite(column === "inviteCode" ? 6 : 8);
    const exists = await db
      .select({ id: trips.id })
      .from(trips)
      .where(eq(trips[column], candidate))
      .limit(1)
      .then((rows) => rows[0] ?? null);
    if (!exists) return candidate;
  }
  throw new Error(`Could not generate ${column}.`);
}

export async function createTripForHost(params: {
  hostId: string;
  name: string;
  schoolName?: string;
  startDate?: string; // YYYY-MM-DD — omitted until AI/import sets dates
  endDate?: string; // YYYY-MM-DD
  timezone?: string;
  defaultCountryCallingCode?: string; // e.g. NZ
  destinationCountry?: string | null;
  destinationLanguage?: string | null;
  setupMethod?: "ai" | "wizard";
  departureCity?: string | null;
  returnCity?: string | null;
  defaultDepartureAirport?: string | null;
}) {
  const inviteCode = await uniqueTripCode("inviteCode");
  const viewerCode = await uniqueTripCode("viewerCode");
  const dates =
    params.startDate && params.endDate
      ? { startDate: params.startDate, endDate: params.endDate }
      : unsetTripDateRange();

  const [trip] = await db
    .insert(trips)
    .values({
      name: params.name.trim(),
      schoolName: (params.schoolName ?? "School trip").trim(),
      inviteCode,
      viewerCode,
      hostCodeHash: null,
      startDate: dates.startDate,
      endDate: dates.endDate,
      timezone: (params.timezone ?? "UTC").trim(),
      defaultCountryCallingCode: (params.defaultCountryCallingCode ?? "NZ")
        .trim()
        .toUpperCase(),
      destinationCountry: params.destinationCountry ?? null,
      destinationLanguage: params.destinationLanguage ?? null,
      setupMethod: params.setupMethod ?? "ai",
      departureCity: params.departureCity?.trim() || null,
      returnCity: params.returnCity?.trim() || null,
      defaultDepartureAirport: params.defaultDepartureAirport?.trim() || null,
      publishedVersion: 0,
    })
    .returning({
      id: trips.id,
      inviteCode: trips.inviteCode,
      viewerCode: trips.viewerCode,
    });

  if (!trip) throw new Error("Failed to create trip.");

  await db.insert(hostTripMembers).values({
    hostId: params.hostId,
    tripId: trip.id,
    canEdit: true,
    acceptedAt: new Date(),
  });

  await ensureMainGroupForTrip(trip.id);

  return trip;
}

