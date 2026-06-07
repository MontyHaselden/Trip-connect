import { eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import {
  itineraryItems,
  tripAccommodationStays,
  tripDays,
  tripTransportLegs,
} from "@/lib/db/schema";

/** Wipe itinerary structure before a fresh AI import. */
export async function clearTripContent(tripId: string) {
  await db.delete(itineraryItems).where(eq(itineraryItems.tripId, tripId));
  await db.delete(tripTransportLegs).where(eq(tripTransportLegs.tripId, tripId));
  await db.delete(tripAccommodationStays).where(eq(tripAccommodationStays.tripId, tripId));
  await db.delete(tripDays).where(eq(tripDays.tripId, tripId));
}
