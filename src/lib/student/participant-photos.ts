export type ParticipantPhoto = {
  id: string;
  tripDayId: string;
  type: "selfie" | "place";
  imageUrl: string;
  thumbnailUrl: string | null;
  uploadedAt: string;
};

export function photosForDay(photos: ParticipantPhoto[], tripDayId: string) {
  return photos.filter((p) => p.tripDayId === tripDayId);
}

export function dayPhotosComplete(photos: ParticipantPhoto[], tripDayId: string) {
  const dayPhotos = photosForDay(photos, tripDayId);
  return (
    dayPhotos.some((p) => p.type === "selfie") &&
    dayPhotos.some((p) => p.type === "place")
  );
}

export function dayNeedsPhotoReminder(
  photos: ParticipantPhoto[],
  tripDayId: string,
  dayDateISO: string,
  todayISO: string | null,
) {
  if (!todayISO || dayDateISO > todayISO) return false;
  return !dayPhotosComplete(photos, tripDayId);
}
