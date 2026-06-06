"use client";

import { useMemo, useState } from "react";

import { useTripApp } from "@/components/layout/TripAppContext";
import { DayPhotoUpload } from "./DayPhotoUpload";

export function TodayPhotoPrompt(props: { tripId: string; tripTimezone: string }) {
  const { todayNav } = useTripApp();
  const [open, setOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const tripDayId = useMemo(() => {
    if (!todayNav) return null;
    const day = todayNav.scheduledDays.find(
      (d) => d.date === todayNav.selectedDateISO,
    );
    return day?.id ?? null;
  }, [todayNav]);

  const showEveningPrompt = useMemo(() => {
    try {
      const hour = Number(
        new Intl.DateTimeFormat("en-GB", {
          hour: "numeric",
          hour12: false,
          timeZone: props.tripTimezone,
        }).format(new Date()),
      );
      return hour >= 18;
    } catch {
      return false;
    }
  }, [props.tripTimezone]);

  if (!tripDayId) return null;

  if (!open && !showEveningPrompt) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-2 shrink-0 text-center text-xs font-medium text-sky-700"
      >
        Add today&apos;s photos
      </button>
    );
  }

  return (
    <section className="mt-2 shrink-0 rounded-xl border border-zinc-200 bg-white p-3">
      <p className="text-xs font-semibold text-zinc-800">Add photos from today</p>
      <div key={refreshKey} className="mt-2 grid gap-2 sm:grid-cols-2">
        <DayPhotoUpload
          tripId={props.tripId}
          tripDayId={tripDayId}
          type="selfie"
          label="You"
          onUploaded={() => setRefreshKey((k) => k + 1)}
        />
        <DayPhotoUpload
          tripId={props.tripId}
          tripDayId={tripDayId}
          type="place"
          label="A place"
          onUploaded={() => setRefreshKey((k) => k + 1)}
        />
      </div>
    </section>
  );
}
