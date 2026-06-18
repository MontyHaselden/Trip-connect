"use client";

import { useMemo, useState } from "react";
import { DateTime } from "luxon";

import { useTripApp } from "@/components/layout/TripAppContext";
import { useStudentOverlay } from "@/components/student/StudentOverlayContext";
import {
  photosForDay,
  type ParticipantPhoto,
} from "@/lib/student/participant-photos";
import { studentOverlayRootClass } from "@/lib/student/overlay-classes";

import { DayPhotoUpload } from "./DayPhotoUpload";

function PhotoViewer(props: {
  photo: ParticipantPhoto;
  label: string;
  onClose: () => void;
}) {
  const { photo, label, onClose } = props;
  const { contained } = useStudentOverlay();

  return (
    <div className={`${studentOverlayRootClass(contained, { zClass: "z-[70]", align: "center" })} bg-black/80 p-4`}>
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0"
      />
      <div className="relative max-h-full w-full max-w-md">
        <button
          type="button"
          onClick={onClose}
          className="absolute -top-10 right-0 text-sm font-medium text-white"
        >
          Close
        </button>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo.imageUrl}
          alt={label}
          className="max-h-[80dvh] w-full rounded-xl object-contain"
        />
        <p className="mt-2 text-center text-xs text-white/90">{label}</p>
      </div>
    </div>
  );
}

function PhotoThumb(props: {
  photo: ParticipantPhoto;
  label: string;
  onView: () => void;
}) {
  const { photo, label, onView } = props;

  return (
    <button
      type="button"
      onClick={onView}
      className="overflow-hidden rounded-lg border border-[var(--student-line)] bg-[var(--student-bg)] text-left"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photo.thumbnailUrl ?? photo.imageUrl}
        alt={label}
        className="aspect-square w-full object-cover"
      />
      <p className="px-2 py-1.5 text-[11px] font-medium text-[var(--student-text-muted)]">{label}</p>
    </button>
  );
}

export function DayPhotoGallery(props: {
  tripId: string;
  days: Array<{ id: string; date: string; cityLabel: string }>;
  tripTimezone: string;
}) {
  const { todayNav, participantPhotos, refreshPhotos } = useTripApp();
  const [viewer, setViewer] = useState<{
    photo: ParticipantPhoto;
    label: string;
  } | null>(null);

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

  const galleryByDay = useMemo(() => {
    const dayById = new Map(props.days.map((d) => [d.id, d]));
    const groups = new Map<
      string,
      { day: (typeof props.days)[number]; photos: ParticipantPhoto[] }
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
  }, [participantPhotos, props.days]);

  const selectedDayLabel = useMemo(() => {
    if (!selectedDay) return null;
    const dt = DateTime.fromISO(selectedDay.date, { zone: props.tripTimezone });
    return `${dt.toFormat("ccc d LLL")} · ${selectedDay.cityLabel}`;
  }, [selectedDay, props.tripTimezone]);

  if (!selectedDay) return null;

  return (
    <section className="student-card">
      <h2 className="text-base font-bold text-[var(--student-text)]">Daily photos</h2>
      <p className="mt-1 text-xs text-[var(--student-text-muted)]">
        {selectedDayLabel
          ? `Upload two photos from ${selectedDayLabel} — one of you and one from somewhere you visited.`
          : "Upload two photos from the selected day — one of you and one from somewhere you visited."}
      </p>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {selfie ? (
          <PhotoThumb
            photo={selfie}
            label="Photo of you"
            onView={() =>
              setViewer({ photo: selfie, label: "Photo of you" })
            }
          />
        ) : (
          <DayPhotoUpload
            tripId={props.tripId}
            tripDayId={selectedDay.id}
            type="selfie"
            label="Photo of you"
            onUploaded={() => refreshPhotos()}
          />
        )}
        {place ? (
          <PhotoThumb
            photo={place}
            label="Photo of a place"
            onView={() =>
              setViewer({ photo: place, label: "Photo of a place" })
            }
          />
        ) : (
          <DayPhotoUpload
            tripId={props.tripId}
            tripDayId={selectedDay.id}
            type="place"
            label="Photo of a place"
            onUploaded={() => refreshPhotos()}
          />
        )}
      </div>

      {galleryByDay.length > 0 ? (
        <div className="mt-5 border-t border-[var(--student-line)] pt-4">
          <h3 className="text-sm font-bold text-[var(--student-text)]">Your gallery</h3>
          <p className="mt-0.5 text-xs text-[var(--student-text-muted)]">
            Tap a photo to view it full size.
          </p>
          <div className="mt-3 space-y-4">
            {galleryByDay.map(({ day, photos }) => {
              const dt = DateTime.fromISO(day.date, { zone: props.tripTimezone });
              return (
                <div key={day.id}>
                  <p className="text-xs font-medium text-[var(--student-text-muted)]">
                    {dt.toFormat("ccc d LLL")} · {day.cityLabel}
                  </p>
                  <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {photos.map((photo) => {
                      const label =
                        photo.type === "selfie" ? "Photo of you" : "Photo of a place";
                      return (
                        <PhotoThumb
                          key={photo.id}
                          photo={photo}
                          label={label}
                          onView={() => setViewer({ photo, label })}
                        />
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {viewer ? (
        <PhotoViewer
          photo={viewer.photo}
          label={viewer.label}
          onClose={() => setViewer(null)}
        />
      ) : null}
    </section>
  );
}
