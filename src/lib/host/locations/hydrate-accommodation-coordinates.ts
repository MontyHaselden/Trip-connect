import { eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { tripAccommodationStays } from "@/lib/db/schema";
import { getGooglePlaceDetails } from "@/lib/geo/google-places";

type StayRow = {
  id: string;
  googlePlaceId: string | null;
  latitude: string | null;
  longitude: string | null;
};

function rowHasValidCoords(lat: string | null, lng: string | null): boolean {
  if (lat == null || lng == null) return false;
  const la = Number(lat);
  const ln = Number(lng);
  return Number.isFinite(la) && Number.isFinite(ln);
}

/** Backfill lat/lng from Google when a stay has place id but missing coordinates (e.g. pre-migration data). */
export async function hydrateAccommodationCoordinates<T extends StayRow>(
  stays: T[],
): Promise<T[]> {
  const needsHydration = stays.filter(
    (stay) => stay.googlePlaceId?.trim() && !rowHasValidCoords(stay.latitude, stay.longitude),
  );
  if (!needsHydration.length) return stays;

  const updates = new Map<string, { lat: number; lng: number }>();

  await Promise.all(
    needsHydration.map(async (stay) => {
      const details = await getGooglePlaceDetails(stay.googlePlaceId!);
      if (
        details?.lat == null ||
        details?.lng == null ||
        !Number.isFinite(details.lat) ||
        !Number.isFinite(details.lng)
      ) {
        return;
      }

      updates.set(stay.id, { lat: details.lat, lng: details.lng });
      await db
        .update(tripAccommodationStays)
        .set({
          latitude: String(details.lat),
          longitude: String(details.lng),
        })
        .where(eq(tripAccommodationStays.id, stay.id));
    }),
  );

  if (!updates.size) return stays;

  return stays.map((stay) => {
    const coords = updates.get(stay.id);
    if (!coords) return stay;
    return {
      ...stay,
      latitude: String(coords.lat),
      longitude: String(coords.lng),
    };
  });
}
