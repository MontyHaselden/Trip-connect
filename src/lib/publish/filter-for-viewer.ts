import type { PublishedTripSnapshotV1 } from "@/types/published-trip";
import {
  filterEntitiesForViewer,
  isVisibleToViewer,
} from "@/lib/visibility/resolve-visible";
import { targetsForEntity } from "@/lib/visibility/types";

export type ViewerFilteredTrip = {
  version: number;
  publishedAt: string;
  trip: PublishedTripSnapshotV1["trip"];
  days: PublishedTripSnapshotV1["days"];
  itineraryItems: Array<
    Omit<PublishedTripSnapshotV1["itineraryItems"][number], "hostNote">
  >;
  photos: Array<{
    id: string;
    tripDayId: string;
    type: "selfie" | "place";
    imageUrl: string;
    thumbnailUrl: string | null;
  }>;
};

function withLegacyAudience<
  T extends {
    visibilityMode?: string;
    audienceType?: string;
    audienceId?: string | null;
  },
>(entity: T) {
  return {
    ...entity,
    visibilityMode: (entity.visibilityMode ?? "everyone") as
      | "everyone"
      | "staff_only"
      | "viewers_only"
      | "hidden_from_students"
      | "custom",
    audienceType: (entity.audienceType ?? "everyone") as
      | "everyone"
      | "group"
      | "room"
      | "participant",
    audienceId: entity.audienceId ?? null,
  };
}

export function filterSnapshotForViewer(
  snapshot: PublishedTripSnapshotV1 & {
    photos?: Array<{
      id: string;
      tripDayId: string;
      type: "selfie" | "place";
      imageUrl: string;
      thumbnailUrl: string | null;
      status: string;
    }>;
  },
  options: { galleryEnabled: boolean; roomDetailsEnabled: boolean },
): ViewerFilteredTrip {
  const allTargets = snapshot.visibilityTargets ?? [];

  const visibleItems = filterEntitiesForViewer(
    snapshot.itineraryItems.map(withLegacyAudience),
    "itinerary_item",
    allTargets,
  );

  const itineraryItems = visibleItems
    .filter((item) => {
      const entity = withLegacyAudience(item);
      if (entity.visibilityMode === "staff_only") return false;
      if (entity.visibilityMode === "custom") {
        return isVisibleToViewer(entity, targetsForEntity("itinerary_item", item.id, allTargets));
      }
      return isVisibleToViewer(entity, targetsForEntity("itinerary_item", item.id, allTargets));
    })
    .map(({ hostNote: _hostNote, ...item }) => item);

  const photos =
    options.galleryEnabled && snapshot.photos
      ? snapshot.photos
          .filter((p) => p.status === "visible")
          .map((p) => ({
            id: p.id,
            tripDayId: p.tripDayId,
            type: p.type,
            imageUrl: p.imageUrl,
            thumbnailUrl: p.thumbnailUrl,
          }))
      : [];

  return {
    version: snapshot.version,
    publishedAt: snapshot.publishedAt,
    trip: snapshot.trip,
    days: snapshot.days,
    itineraryItems,
    photos,
  };
}
