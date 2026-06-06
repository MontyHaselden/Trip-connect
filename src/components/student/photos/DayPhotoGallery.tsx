"use client";

import { useMemo, useState } from "react";

import { useTripApp } from "@/components/layout/TripAppContext";
import { DayPhotoUpload } from "./DayPhotoUpload";

export function DayPhotoGallery(props: { tripId: string }) {
  const { todayNav } = useTripApp();
  const [refreshKey, setRefreshKey] = useState(0);

  const tripDayId = useMemo(() => {
    if (!todayNav) return null;
    const day = todayNav.scheduledDays.find(
      (d) => d.date === todayNav.selectedDateISO,
    );
    return day?.id ?? todayNav.scheduledDays[0]?.id ?? null;
  }, [todayNav]);

  if (!tripDayId) return null;

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-5">
      <h2 className="text-base font-semibold">Daily photos</h2>
      <p className="mt-1 text-xs text-zinc-600">
        Upload two photos from the selected day — one of you and one from somewhere you visited.
      </p>
      <div key={refreshKey} className="mt-3 grid gap-3 sm:grid-cols-2">
        <DayPhotoUpload
          tripId={props.tripId}
          tripDayId={tripDayId}
          type="selfie"
          label="Photo of you"
          onUploaded={() => setRefreshKey((k) => k + 1)}
        />
        <DayPhotoUpload
          tripId={props.tripId}
          tripDayId={tripDayId}
          type="place"
          label="Photo of a place"
          onUploaded={() => setRefreshKey((k) => k + 1)}
        />
      </div>
    </section>
  );
}
