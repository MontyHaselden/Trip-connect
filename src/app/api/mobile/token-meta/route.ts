import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { trips } from "@/lib/db/schema";
import { findValidMobileToken } from "@/lib/mobile/tokens";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  if (!token) {
    return NextResponse.json({ error: "Missing token." }, { status: 400 });
  }

  const record = await findValidMobileToken(token);
  if (!record) {
    return NextResponse.json({ error: "Invalid token." }, { status: 404 });
  }

  const trip = await db
    .select({
      tripId: trips.id,
      tripName: trips.name,
      inviteCode: trips.inviteCode,
    })
    .from(trips)
    .where(eq(trips.id, record.tripId))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (!trip) {
    return NextResponse.json({ error: "Trip not found." }, { status: 404 });
  }

  return NextResponse.json(trip);
}
