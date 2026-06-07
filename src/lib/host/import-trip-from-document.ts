import { eq } from "drizzle-orm";

import {
  applyItineraryItem,
  ensureTripDay,
} from "@/lib/ai/apply-itinerary-import";
import { parseDayItemsFromDocument } from "@/lib/ai/parse-day-items-from-document";
import { parseTripStructureFromDocument } from "@/lib/ai/parse-trip-structure-from-document";
import { parseTripOutlineFromDocument } from "@/lib/ai/parse-trip-outline";
import { db } from "@/lib/db/client";
import { trips } from "@/lib/db/schema";
import { applyTripLocationState } from "@/lib/host/locations/apply-location-state";
import { clearTripContent } from "@/lib/host/locations/clear-trip-content";
import type { TripLocationState } from "@/lib/host/locations/types";
import { buildDefaultDayPlaces, syncIntercityLegs } from "@/lib/host/wizard/detect-city-moves";
import { analyzeImportGaps } from "@/lib/host/wizard/analyze-import-gaps";
import { maybeAutoPublish } from "@/lib/publish/maybe-auto-publish";
import type { TripImportProgress } from "@/types/trip-import-progress";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function outlineDaysToPlaces(
  days: Array<{ date: string; cityLabel: string }>,
): TripLocationState["dayPlaces"] {
  return days.map((d) => ({
    date: d.date,
    primaryCity: d.cityLabel,
    secondaryCity: null,
    primaryShare: 1,
    dayType: "trip" as const,
    includeBuffer: false,
  }));
}

export async function importTripFromDocumentText(params: {
  tripId: string;
  text: string;
  defaultTimezone: string;
  instructions?: string | null;
  preserveTripName?: string | null;
  onProgress?: (event: TripImportProgress) => void;
}) {
  const emit = (event: TripImportProgress) => params.onProgress?.(event);

  emit({ type: "phase", phase: "reading" });

  emit({ type: "phase", phase: "planning" });
  const outline = await parseTripOutlineFromDocument({
    text: params.text,
    defaultTimezone: params.defaultTimezone,
    instructions: params.instructions,
  });

  await clearTripContent(params.tripId);

  emit({ type: "phase", phase: "structure" });
  const structure = await parseTripStructureFromDocument({
    text: params.text,
    startDate: outline.startDate,
    endDate: outline.endDate,
    defaultTimezone: outline.timezone,
    instructions: params.instructions,
  });

  const departureCity =
    structure.departureCity?.trim() || outline.days[0]?.cityLabel || "";
  const returnCity =
    structure.returnCity?.trim() ||
    outline.days[outline.days.length - 1]?.cityLabel ||
    "";

  let dayPlaces = structure.dayPlaces.length
    ? structure.dayPlaces
    : outlineDaysToPlaces(outline.days);

  if (!dayPlaces.length) {
    dayPlaces = buildDefaultDayPlaces(
      outline.startDate,
      outline.endDate,
      departureCity,
      returnCity,
    );
  }

  const intercityLegs = syncIntercityLegs(dayPlaces, structure.intercityLegs, {
    outboundLegs: structure.outboundLegs,
    returnLegs: structure.returnLegs,
    trip: {
      startDate: outline.startDate,
      endDate: outline.endDate,
      departureCity,
      returnCity,
    },
  });

  const locationState: TripLocationState = {
    basics: {
      name: params.preserveTripName?.trim() || outline.name.trim(),
      schoolName: outline.schoolName.trim(),
      startDate: outline.startDate,
      endDate: outline.endDate,
      timezone: outline.timezone.trim(),
      departureCity,
      returnCity,
      destinationCountries: outline.destinationCountry
        ? outline.destinationCountry.split(",").map((c) => c.trim()).filter(Boolean)
        : [],
    },
    dayPlaces,
    outboundLegs: structure.outboundLegs,
    returnLegs: structure.returnLegs,
    intercityLegs,
    accommodationStays: structure.accommodationStays,
  };

  await db
    .update(trips)
    .set({
      name: locationState.basics.name,
      schoolName: locationState.basics.schoolName,
      startDate: outline.startDate,
      endDate: outline.endDate,
      timezone: outline.timezone.trim(),
      departureCity,
      returnCity,
      destinationCountry: outline.destinationCountry,
      destinationLanguage: outline.destinationLanguage,
      updatedAt: new Date(),
    })
    .where(eq(trips.id, params.tripId));

  await applyTripLocationState(params.tripId, locationState);

  emit({ type: "phase", phase: "structure_applied" });

  emit({
    type: "trip_dates",
    startDate: outline.startDate,
    endDate: outline.endDate,
    dayCount: outline.days.length,
    timezone: outline.timezone,
  });

  let daysCreated = 0;
  let daysUpdated = 0;
  let itemsCreated = 0;

  emit({ type: "phase", phase: "building" });

  for (let i = 0; i < outline.days.length; i++) {
    const day = outline.days[i]!;
    emit({
      type: "day_start",
      index: i + 1,
      total: outline.days.length,
      date: day.date,
      cityLabel: day.cityLabel,
    });

    const items = await parseDayItemsFromDocument({
      text: params.text,
      date: day.date,
      cityLabel: day.cityLabel,
      defaultTimezone: outline.timezone,
      startDate: outline.startDate,
      endDate: outline.endDate,
      instructions: params.instructions,
    });

    const ensured = await ensureTripDay(params.tripId, day);
    if (ensured.created) daysCreated++;
    if (ensured.updated) daysUpdated++;

    for (let j = 0; j < items.length; j++) {
      const item = items[j]!;
      await applyItineraryItem(params.tripId, ensured.dayId, item);
      itemsCreated++;

      emit({
        type: "item_added",
        date: day.date,
        index: j + 1,
        total: items.length,
        title: item.title,
        category: item.category ?? null,
      });

      await sleep(150);
    }

    emit({
      type: "day_complete",
      date: day.date,
      itemCount: items.length,
    });
  }

  await maybeAutoPublish(params.tripId);

  const gaps = await analyzeImportGaps(params.tripId);
  if (gaps.length) {
    emit({ type: "gaps", gaps });
  }

  const result = {
    stats: { daysCreated, daysUpdated, itemsCreated },
    trip: {
      name: outline.name,
      schoolName: outline.schoolName,
      startDate: outline.startDate,
      endDate: outline.endDate,
      timezone: outline.timezone,
    },
    gaps,
  };

  emit({ type: "done", ...result });
  return result;
}
