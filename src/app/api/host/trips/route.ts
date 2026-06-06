import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/lib/db/client";
import { hostTripMembers, trips } from "@/lib/db/schema";
import { hostApiError } from "@/lib/host/api-errors";
import { requireHostSessionHostId, setHostSessionCookie } from "@/lib/auth/host-session";
import { createTripShell } from "@/lib/host/create-trip-with-document";

export const runtime = "nodejs";

const CreateJsonSchema = z.object({
  name: z.string().trim().min(2).max(200),
});

function parseCreateName(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") return null;
  const name = value.trim();
  return name.length >= 2 ? name : null;
}

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

/** Fast trip shell creation only — import document from the builder for live preview. */
export async function POST(req: Request) {
  try {
    const hostId = await requireHostSessionHostId();
    const contentType = req.headers.get("content-type") ?? "";

    let name: string;

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData().catch(() => null);
      if (!form) {
        return NextResponse.json({ error: "Invalid request." }, { status: 400 });
      }
      const parsedName = parseCreateName(form.get("name"));
      if (!parsedName) {
        return NextResponse.json({ error: "Enter a trip name (at least 2 characters)." }, { status: 400 });
      }
      name = parsedName;
    } else {
      const json = await req.json().catch(() => null);
      const parsed = CreateJsonSchema.safeParse(json);
      if (!parsed.success) {
        return NextResponse.json({ error: "Enter a trip name (at least 2 characters)." }, { status: 400 });
      }
      name = parsed.data.name;
    }

    const trip = await createTripShell({ hostId, name });
    await setHostSessionCookie({ hostId, activeTripId: trip.id });

    return NextResponse.json({
      ok: true,
      tripId: trip.id,
      inviteCode: trip.inviteCode,
    });
  } catch (err) {
    return hostApiError(err);
  }
}
