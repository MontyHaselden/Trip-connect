"use client";

import { useState } from "react";
import { DateTime } from "luxon";

import { StudentBottomSheet } from "@/components/student/StudentBottomSheet";
import type { ParticipantPhoto } from "@/lib/student/participant-photos";

function PhotoViewer(props: {
  photo: ParticipantPhoto;
  label: string;
  onClose: () => void;
}) {
  const { photo, label, onClose } = props;

  return (
    <div className="fixed inset-0 z-[75] flex items-center justify-center bg-black/80 p-4">
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
      <p className="px-2 py-1.5 text-[10px] font-medium text-[var(--student-text-muted)]">
        {label}
      </p>
    </button>
  );
}

export function PhotoGallerySheet(props: {
  open: boolean;
  onClose: () => void;
  tripTimezone: string;
  galleryByDay: Array<{
    day: { id: string; date: string; cityLabel: string };
    photos: ParticipantPhoto[];
  }>;
}) {
  const { open, onClose, tripTimezone, galleryByDay } = props;
  const [viewer, setViewer] = useState<{
    photo: ParticipantPhoto;
    label: string;
  } | null>(null);

  return (
    <>
      <StudentBottomSheet open={open} onClose={onClose} title="Your gallery" maxHeight="80dvh">
        {!galleryByDay.length ? (
          <p className="pb-2 text-sm text-[var(--student-text-muted)]">No photos yet.</p>
        ) : (
          <div className="space-y-4 pb-2">
            {galleryByDay.map(({ day, photos }) => {
              const dt = DateTime.fromISO(day.date, { zone: tripTimezone });
              return (
                <div key={day.id}>
                  <p className="text-xs font-semibold text-[var(--student-text-muted)]">
                    {dt.toFormat("ccc d LLL")} · {day.cityLabel}
                  </p>
                  <div className="mt-2 grid grid-cols-2 gap-2">
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
        )}
      </StudentBottomSheet>
      {viewer ? (
        <PhotoViewer
          photo={viewer.photo}
          label={viewer.label}
          onClose={() => setViewer(null)}
        />
      ) : null}
    </>
  );
}
