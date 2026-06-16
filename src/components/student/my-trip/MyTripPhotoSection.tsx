"use client";

import { useMemo } from "react";
import { DateTime } from "luxon";

import { useTripApp } from "@/components/layout/TripAppContext";
import { MyTripMenuRow } from "@/components/student/my-trip/MyTripMenuRow";
import { PhotoUploadTile } from "@/components/student/photos/PhotoUploadTile";
import {
  photosForDay,
  type ParticipantPhoto,
} from "@/lib/student/participant-photos";

export function MyTripPhotoSection(props: {
  tripId: string;
  days: Array<{ id: string; date: string; cityLabel: string }>;
  tripTimezone: string;
  onOpenGallery: () => void;
}) {
  const { todayNav, participantPhotos, refreshPhotos } = useTripApp();

  const selectedDay = useMemo(() => {
    if (!todayNav) return props.days[0] ?? null;
    return (
      props.days.find((d) => d.date === todayNav.selectedDateISO) ??
      props.days[0] ??
      null
    );
  }, [todayNav, props.days]);

  const dayPhotos = useMemo(() => {
    if (!selectedDay) return [];
    return photosForDay(participantPhotos, selectedDay.id);
  }, [participantPhotos, selectedDay]);

  const selfie = dayPhotos.find((p) => p.type === "selfie") ?? null;
  const place = dayPhotos.find((p) => p.type === "place") ?? null;

  const totalPhotos = participantPhotos.length;

  const selectedDayLabel = useMemo(() => {
    if (!selectedDay) return null;
    const dt = DateTime.fromISO(selectedDay.date, { zone: props.tripTimezone });
    return `${dt.toFormat("ccc d MMM")} · ${selectedDay.cityLabel}`;
  }, [selectedDay, props.tripTimezone]);

  if (!selectedDay) return null;

  return (
    <section>
      <div className="mb-2">
        <h2 className="text-sm font-bold text-[var(--student-text)]">Daily photos</h2>
        {selectedDayLabel ? (
          <p className="mt-0.5 text-xs text-[var(--student-text-muted)]">{selectedDayLabel}</p>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <PhotoUploadTile
          tripId={props.tripId}
          tripDayId={selectedDay.id}
          type="selfie"
          title="Photo of you"
          helper="Select from camera roll"
          previewUrl={selfie?.thumbnailUrl ?? selfie?.imageUrl ?? null}
          onUploaded={() => refreshPhotos()}
        />
        <PhotoUploadTile
          tripId={props.tripId}
          tripDayId={selectedDay.id}
          type="place"
          title="Photo of a place"
          helper="Select from camera roll"
          previewUrl={place?.thumbnailUrl ?? place?.imageUrl ?? null}
          onUploaded={() => refreshPhotos()}
        />
      </div>

      {totalPhotos > 0 ? (
        <div className="mt-3 student-menu-group">
          <MyTripMenuRow
            title="Your gallery"
            subtitle={`${totalPhotos} photo${totalPhotos === 1 ? "" : "s"}`}
            onClick={props.onOpenGallery}
          />
        </div>
      ) : null}
    </section>
  );
}

export function usePhotoGalleryByDay(
  days: Array<{ id: string; date: string; cityLabel: string }>,
  participantPhotos: ParticipantPhoto[],
) {
  return useMemo(() => {
    const dayById = new Map(days.map((d) => [d.id, d]));
    const groups = new Map<
      string,
      { day: (typeof days)[number]; photos: ParticipantPhoto[] }
    >();

    for (const photo of participantPhotos) {
      const day = dayById.get(photo.tripDayId);
      if (!day) continue;
      const existing = groups.get(photo.tripDayId);
      if (existing) {
        existing.photos.push(photo);
      } else {
        groups.set(photo.tripDayId, { day, photos: [photo] });
      }
    }

    return [...groups.values()].sort((a, b) => a.day.date.localeCompare(b.day.date));
  }, [participantPhotos, days]);
}
