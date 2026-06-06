import type { PublishedTripSnapshotV1 } from "@/types/published-trip";

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
  const itineraryItems = snapshot.itineraryItems.map(
    ({ hostNote: _hostNote, ...item }) => item,
  );

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
