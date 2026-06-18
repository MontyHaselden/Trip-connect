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
import { applyTripLocationState, purgeAccommodationWizardItineraryItems } from "@/lib/host/locations/apply-location-state";
import { clearTripContent } from "@/lib/host/locations/clear-trip-content";
import { applyTripSetupState } from "@/lib/host/setup/apply-setup-state";
import { loadTripSetupState } from "@/lib/host/setup/load-setup-state";
import { alignAccommodationStaysToLocationStays } from "@/lib/host/setup/accommodation-calendar";
import { syncTripBoundsFromContent } from "@/lib/host/setup/sync-trip-bounds";
import type { TripLocationState } from "@/lib/host/locations/types";
import {
  sanitizeTripOutlineDates,
  sanitizeTripStructureDates,
} from "@/lib/host/import/sanitize-imported-dates";
import {
  reconcileImportedAccommodationStays,
} from "@/lib/host/import/reconcile-accommodation-stays";
import {
  filterMisplacedHomeDirectionLegs,
  filterSpuriousAutoTransfers,
  fillGapsBetweenLocationStays,
  mergeImportedDayPlacesWithOutline,
  reconcileImportedDayPlacesWithFlights,
  sanitizeImportedDayPlaces,
  sanitizeImportedTransport,
} from "@/lib/host/import/sanitize-imported-locations";
import { buildDefaultDayPlaces, syncIntercityLegs } from "@/lib/host/wizard/detect-city-moves";
import { analyzeImportGaps } from "@/lib/host/wizard/analyze-import-gaps";
import { maybeAutoPublish } from "@/lib/publish/maybe-auto-publish";
import type { TripImportProgress } from "@/types/trip-import-progress";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
  const outline = sanitizeTripOutlineDates(
    await parseTripOutlineFromDocument({
      text: params.text,
      defaultTimezone: params.defaultTimezone,
      instructions: params.instructions,
    }),
  );

  await clearTripContent(params.tripId);

  emit({ type: "phase", phase: "structure" });
  const structure = sanitizeTripStructureDates(
    await parseTripStructureFromDocument({
      text: params.text,
      startDate: outline.startDate,
      endDate: outline.endDate,
      defaultTimezone: outline.timezone,
      instructions: params.instructions,
    }),
  );

  const departureCity =
    structure.departureCity?.trim() || outline.days[0]?.cityLabel || "";
  const returnCity =
    structure.returnCity?.trim() ||
    outline.days[outline.days.length - 1]?.cityLabel ||
    "";

  let dayPlaces = mergeImportedDayPlacesWithOutline(structure.dayPlaces, outline.days);

  if (!dayPlaces.length) {
    dayPlaces = buildDefaultDayPlaces(
      outline.startDate,
      outline.endDate,
      departureCity,
      returnCity,
    );
  }

  dayPlaces = sanitizeImportedDayPlaces(dayPlaces, {
    departureCity,
    returnCity,
    startDate: outline.startDate,
    endDate: outline.endDate,
  });

  dayPlaces = fillGapsBetweenLocationStays(dayPlaces, {
    startDate: outline.startDate,
    endDate: outline.endDate,
    departureCity,
    returnCity,
  });

  const tripBounds = {
    startDate: outline.startDate,
    endDate: outline.endDate,
    departureCity,
    returnCity,
  };

  const outboundLegs = sanitizeImportedTransport(
    filterMisplacedHomeDirectionLegs(structure.outboundLegs, tripBounds),
  );
  const returnLegs = sanitizeImportedTransport(
    filterMisplacedHomeDirectionLegs(structure.returnLegs, tripBounds),
  );
  const structureIntercity = sanitizeImportedTransport(
    filterMisplacedHomeDirectionLegs(structure.intercityLegs, tripBounds),
  );

  const planeLegsBeforeSync = [
    ...outboundLegs,
    ...returnLegs,
    ...structureIntercity.filter((leg) => leg.transportType === "plane"),
  ];
  dayPlaces = reconcileImportedDayPlacesWithFlights(
    dayPlaces,
    planeLegsBeforeSync,
    structure.accommodationStays,
  );

  const intercityLegs = sanitizeImportedTransport(
    filterSpuriousAutoTransfers(
      syncIntercityLegs(dayPlaces, structureIntercity, {
        outboundLegs,
        returnLegs,
        trip: tripBounds,
      }),
      tripBounds,
      planeLegsBeforeSync,
    ),
  );

  const allPlaneLegs = [
    ...outboundLegs,
    ...returnLegs,
    ...intercityLegs.filter((leg) => leg.transportType === "plane"),
  ];
  dayPlaces = reconcileImportedDayPlacesWithFlights(
    dayPlaces,
    allPlaneLegs,
    structure.accommodationStays,
  );

  const allDepartureLegs = [...outboundLegs, ...returnLegs, ...intercityLegs];
  let accommodationStays = reconcileImportedAccommodationStays(
    structure.accommodationStays,
    allDepartureLegs,
  );
  accommodationStays = alignAccommodationStaysToLocationStays(
    accommodationStays,
    dayPlaces,
    outline.startDate,
    outline.endDate,
    departureCity,
    returnCity,
  );

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
    outboundLegs,
    returnLegs,
    intercityLegs,
    accommodationStays,
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

  await applyTripLocationState(params.tripId, locationState, {
    syncAccommodationItems: false,
  });

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
      const itemId = await applyItineraryItem(params.tripId, ensured.dayId, item);
      if (!itemId) continue;
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

  await applyTripLocationState(params.tripId, locationState, {
    syncTransportItems: false,
    syncAccommodationItems: false,
  });

  await purgeAccommodationWizardItineraryItems(params.tripId);

  const setupState = await loadTripSetupState(params.tripId);
  if (setupState) {
    await applyTripSetupState(params.tripId, syncTripBoundsFromContent(setupState), {
      skipWizardItineraryItems: true,
      syncTransportItems: false,
      syncAccommodationItems: false,
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
