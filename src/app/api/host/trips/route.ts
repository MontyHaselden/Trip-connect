import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/lib/db/client";
import { hostTripMembers, trips } from "@/lib/db/schema";
import { hostApiError } from "@/lib/host/api-errors";
import { requireHostSessionHostId, setHostSessionCookie } from "@/lib/auth/host-session";
import { createTripForHost } from "@/lib/host/trip-create";

const CreateSchema = z.object({
  name: z.string().trim().min(2).max(200),
  schoolName: z.string().trim().min(2).max(200),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  timezone: z.string().trim().min(1).max(80),
  defaultCountryCallingCode: z.string().trim().min(2).max(2),
  destinationCountry: z.string().trim().max(100).nullable().optional(),
  destinationLanguage: z.string().trim().max(20).nullable().optional(),
});

export async function GET() {
  try {
    const hostId = await requireHostSessionHostId();
    const rows = await db
      .select({
        id: trips.id,
        inviteCode: trips.inviteCode,
        name: trips.name,
        schoolName: trips.schoolName,
        startDate: trips.startDate,
        endDate: trips.endDate,
        publishedVersion: trips.publishedVersion,
      })
      .from(trips)
      .innerJoin(hostTripMembers, eq(hostTripMembers.tripId, trips.id))
      .where(eq(hostTripMembers.hostId, hostId));

    return NextResponse.json({ trips: rows });
  } catch (err) {
    return hostApiError(err);
  }
}

export async function POST(req: Request) {
  try {
    const hostId = await requireHostSessionHostId();
    const json = await req.json().catch(() => null);
    const parsed = CreateSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }

    const trip = await createTripForHost({
      hostId,
      ...parsed.data,
      destinationCountry: parsed.data.destinationCountry ?? null,
      destinationLanguage: parsed.data.destinationLanguage ?? null,
    });
    await setHostSessionCookie({ hostId, activeTripId: trip.id });

    return NextResponse.json({ ok: true, tripId: trip.id, inviteCode: trip.inviteCode });
  } catch (err) {
    return hostApiError(err);
  }
}

