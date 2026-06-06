"use client";

import { useEffect, useState } from "react";

import { CompactDaySheet } from "@/components/student/today/CompactDaySheet";
import { sortItemsByStartTime } from "@/lib/timeline/time-math";
import type { ItineraryRowItem } from "@/lib/utils/itinerary-item-style";
import type { ActivityCategory } from "@/types/activity-category";

type ViewerPayload = {
  trip: {
    trip: { timezone: string; startDate: string; name: string };
    days: Array<{
      id: string;
      date: string;
      cityLabel: string;
      weather?: {
        locationQuery: string;
        tempC: number | null;
        condition: string | null;
        advice: string | null;
        status: "available" | "too_far" | "unavailable";
        fetchedAt: string;
      } | null;
    }>;
    itineraryItems: Array<{
      id: string;
      tripDayId: string;
      startTime: string;
      endTime: string | null;
      title: string;
      locationName: string | null;
      address: string | null;
      mapQuery: string | null;
      transportNote: string | null;
      bringNote: string | null;
      category?: ActivityCategory | null;
      sortOrder: number;
    }>;
    photos: Array<{ imageUrl: string; type: string }>;
  };
};

export function ViewerTripClient(props: { viewerCode: string }) {
  const [data, setData] = useState<ViewerPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/view/${encodeURIComponent(props.viewerCode)}`, { method: "POST" })
      .then((r) => r.json())
      .then((body) => {
        if (body.error) setError(body.error);
        else setData(body);
      })
      .catch(() => setError("Failed to load trip"));
  }, [props.viewerCode]);

  if (error) {
    return <p className="p-10 text-center text-sm text-red-700">{error}</p>;
  }
  if (!data) {
    return <p className="p-10 text-center text-sm text-zinc-600">Loading…</p>;
  }

  const day = data.trip.days[0];
  const items: ItineraryRowItem[] = day
    ? sortItemsByStartTime(
        data.trip.itineraryItems
          .filter((i) => i.tripDayId === day.id)
          .map((i) => ({
            ...i,
            hostNote: null,
            leaveByTime: null,
          })),
      )
    : [];

  return (
    <div className="mx-auto max-w-md px-4 py-6">
      <header className="mb-4 text-center">
        <p className="text-xs font-medium text-sky-700">Viewer access</p>
        <h1 className="text-lg font-semibold">{data.trip.trip.name}</h1>
        <p className="text-xs text-zinc-500">Read-only — no student phone numbers</p>
      </header>
      {day ? (
        <CompactDaySheet
          items={items}
          prepItems={[]}
          tripTimezone={data.trip.trip.timezone}
          dateISO={day.date}
          cityLabel={day.cityLabel}
          weather={day.weather}
          tripStartDate={data.trip.trip.startDate}
          isViewingToday={false}
          mapsOnline
        />
      ) : null}
      {data.trip.photos.length ? (
        <section className="mt-6">
          <h2 className="text-sm font-semibold">Photo gallery</h2>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {data.trip.photos.map((p, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={p.imageUrl} alt="" className="aspect-square rounded-lg object-cover" />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
