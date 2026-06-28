import { codesForCountryNames } from "@/lib/geo/countries";
import { getGooglePlaceDetails } from "@/lib/geo/google-places";
import { searchLodging } from "@/lib/geo/lodging-search";
import type { AccommodationStayDraft } from "@/lib/host/wizard/types";

import type { UpdateStayCommand } from "./commands";
import { projectTripMap } from "./project-trip-map";
import type { TripEntityGraph } from "./types";

export type MapCoordinateResolveResult = {
  stayId: string;
  title: string;
  status: "resolved" | "skipped" | "failed";
  reason?: string;
};

function hasValidCoords(lat?: number | null, lng?: number | null): boolean {
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng)
  );
}

function stayPatchFromPlaceDetails(
  placeId: string,
  details: NonNullable<Awaited<ReturnType<typeof getGooglePlaceDetails>>>,
  stay: AccommodationStayDraft,
): Partial<AccommodationStayDraft> {
  return {
    googlePlaceId: placeId,
    latitude: details.lat ?? null,
    longitude: details.lng ?? null,
    address: stay.address?.trim() ? stay.address : details.address,
  };
}

async function resolveStayCoordinates(
  stay: AccommodationStayDraft,
  countryCodes: string[],
): Promise<Partial<AccommodationStayDraft> | null> {
  if (stay.googlePlaceId?.trim()) {
    const details = await getGooglePlaceDetails(stay.googlePlaceId);
    if (details?.lat != null && details?.lng != null) {
      return stayPatchFromPlaceDetails(stay.googlePlaceId, details, stay);
    }
  }

  const name = stay.name?.trim();
  if (!name) return null;

  const { suggestions } = await searchLodging({
    query: name,
    stayCity: stay.cityLabel,
    countryCodes,
    lodgingOnly: true,
    limit: 5,
  });

  const match = suggestions.find((row) => row.placeId?.trim());
  if (!match?.placeId) return null;

  const details = await getGooglePlaceDetails(match.placeId);
  if (!details?.lat || !details?.lng) return null;

  return stayPatchFromPlaceDetails(match.placeId, details, stay);
}

/** Build updateStay commands for accommodation rows missing map coordinates. */
export async function buildMapCoordinateResolveCommands(
  graph: TripEntityGraph,
  groupId: string,
): Promise<{
  commands: UpdateStayCommand[];
  results: MapCoordinateResolveResult[];
}> {
  const projection = projectTripMap(graph, { groupId });
  const accommodationMissing = projection.missingCoordinates.filter(
    (item) => item.entityType === "accommodation",
  );
  const countryCodes = codesForCountryNames(graph.basics.destinationCountries ?? []);
  const commands: UpdateStayCommand[] = [];
  const results: MapCoordinateResolveResult[] = [];

  for (const item of accommodationMissing) {
    const stay = graph.accommodationStays.find((row) => row.id === item.entityId);
    const title = item.title.trim() || "Unnamed stay";

    if (!stay) {
      results.push({ stayId: item.entityId, title, status: "failed", reason: "Stay not found" });
      continue;
    }

    if (hasValidCoords(stay.latitude, stay.longitude)) {
      results.push({ stayId: stay.id, title, status: "skipped", reason: "Already has coordinates" });
      continue;
    }

    const patch = await resolveStayCoordinates(stay, countryCodes);
    if (!patch?.latitude || !patch?.longitude) {
      results.push({
        stayId: stay.id,
        title,
        status: "failed",
        reason: "No Google match found",
      });
      continue;
    }

    commands.push({
      type: "updateStay",
      groupId: stay.originGroupId ?? groupId,
      stayId: stay.id,
      patch,
    });
    results.push({ stayId: stay.id, title, status: "resolved" });
  }

  return { commands, results };
}
