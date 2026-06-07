import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { participants, tripPhotos, trips } from "@/lib/db/schema";
import { enforcePhotoGallery } from "@/lib/plans/enforce-plan";
import { getTripOwnerAccountId } from "@/lib/plans/account-usage";
import { savePhotoBuffer } from "@/lib/storage/photos";

export async function POST(req: Request) {
  try {
    const auth = req.headers.get("authorization");
    const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
    if (!token) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const form = await req.formData();
    const tripId = String(form.get("tripId") ?? "");
    const tripDayId = String(form.get("tripDayId") ?? "");
    const type = String(form.get("type") ?? "");
    const file = form.get("file");

    if (!tripId || !tripDayId || (type !== "selfie" && type !== "place")) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }
    if (!(file instanceof Blob)) {
      return NextResponse.json({ error: "Missing file." }, { status: 400 });
    }

    const participant = await db
      .select({ id: participants.id })
      .from(participants)
      .where(and(eq(participants.tripId, tripId), eq(participants.accessToken, token)))
      .limit(1)
      .then((rows) => rows[0] ?? null);

    if (!participant) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const trip = await db
      .select({ studentGalleryEnabled: trips.studentGalleryEnabled })
      .from(trips)
      .where(eq(trips.id, tripId))
      .limit(1)
      .then((rows) => rows[0] ?? null);
    if (!trip?.studentGalleryEnabled) {
      return NextResponse.json({ error: "Photo gallery is disabled for this trip." }, { status: 403 });
    }

    const ownerId = await getTripOwnerAccountId(tripId);
    if (ownerId) {
      const galleryCheck = await enforcePhotoGallery(ownerId);
      if (!galleryCheck.allowed) {
        return NextResponse.json({ error: galleryCheck.hardBlock }, { status: 403 });
      }
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const { imageUrl, thumbnailUrl } = await savePhotoBuffer({
      tripId,
      buffer,
      extension: "jpg",
    });

    const [photo] = await db
      .insert(tripPhotos)
      .values({
        tripId,
        tripDayId,
        participantId: participant.id,
        type,
        imageUrl,
        thumbnailUrl,
        status: "visible",
      })
      .returning();

    return NextResponse.json({ photo });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload failed." },
      { status: 500 },
    );
  }
}
