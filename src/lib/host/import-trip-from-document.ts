import { eq } from "drizzle-orm";

import { applyItineraryImport } from "@/lib/ai/apply-itinerary-import";
import { parseTripFromDocument } from "@/lib/ai/parse-trip-document";
import { db } from "@/lib/db/client";
import { trips } from "@/lib/db/schema";
import { maybeAutoPublish } from "@/lib/publish/maybe-auto-publish";

export async function importTripFromDocumentText(params: {
  tripId: string;
  text: string;
  defaultTimezone: string;
  instructions?: string | null;
}) {
  const parsed = await parseTripFromDocument({
    text: params.text,
    defaultTimezone: params.defaultTimezone,
    instructions: params.instructions,
  });

  await db
    .update(trips)
    .set({
      name: parsed.name.trim(),
      schoolName: parsed.schoolName.trim(),
      startDate: parsed.startDate,
      endDate: parsed.endDate,
      timezone: parsed.timezone.trim(),
      destinationCountry: parsed.destinationCountry ?? null,
      destinationLanguage: parsed.destinationLanguage ?? null,
      updatedAt: new Date(),
    })
    .where(eq(trips.id, params.tripId));

  let daysCreated = 0;
  let daysUpdated = 0;
  let itemsCreated = 0;

  for (const day of parsed.days) {
    const stats = await applyItineraryImport(params.tripId, { days: [day] });
    daysCreated += stats.daysCreated;
    daysUpdated += stats.daysUpdated;
    itemsCreated += stats.itemsCreated;
  }

  await maybeAutoPublish(params.tripId);

  return {
    stats: { daysCreated, daysUpdated, itemsCreated },
    trip: {
      name: parsed.name,
      schoolName: parsed.schoolName,
      startDate: parsed.startDate,
      endDate: parsed.endDate,
      timezone: parsed.timezone,
    },
  };
}
