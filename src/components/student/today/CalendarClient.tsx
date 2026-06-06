"use client";

import { Suspense, useMemo } from "react";
import { useRouter } from "next/navigation";

import { useTripApp } from "@/components/layout/TripAppContext";
import { useSelectedTripDay } from "@/hooks/useSelectedTripDay";
import {
  hasTodaySchedule,
  resolveStudentTripPayload,
} from "@/lib/student/resolve-trip-payload";
import { TripNotReady } from "@/components/student/TripNotReady";
import { MonthCalendar } from "@/components/student/today/MonthCalendar";

function CalendarContent() {
  const router = useRouter();
  const { cache } = useTripApp();
  const trip = useMemo(
    () => resolveStudentTripPayload(cache.payload, cache.participantId),
    [cache.payload, cache.participantId],
  );

  const tripNotPublished =
    cache.version === 0 ||
    (cache.version === null &&
      !trip &&
      (cache.status === "up_to_date" || cache.status === "ready"));

  const tripTz = trip?.trip.timezone ?? "UTC";
  const tripDates = trip
    ? { startDate: trip.trip.startDate, endDate: trip.trip.endDate }
    : undefined;

  const { scheduledDays, selectedDay } = useSelectedTripDay(
    trip?.days ?? [],
    tripTz,
    tripDates,
  );

  const itemCountByDayId = useMemo(() => {
    const m = new Map<string, number>();
    if (!trip) return m;
    for (const item of trip.itineraryItems) {
      m.set(item.tripDayId, (m.get(item.tripDayId) ?? 0) + 1);
    }
    return m;
  }, [trip]);

  const firstItemTitleByDayId = useMemo(() => {
    const m = new Map<string, string>();
    if (!trip) return m;
    for (const day of scheduledDays) {
      const first = trip.itineraryItems
        .filter((i) => i.tripDayId === day.id)
        .sort((a, b) => a.startTime.localeCompare(b.startTime))[0];
      if (first) m.set(day.id, first.title);
    }
    return m;
  }, [trip, scheduledDays]);

  if (cache.status === "offline_no_cache") {
    return (
      <div className="py-6 text-center text-sm text-zinc-600">
        Connect to the internet once to download the trip.
      </div>
    );
  }

  if (tripNotPublished && !trip) {
    return <TripNotReady title="Calendar" />;
  }

  if (!hasTodaySchedule(trip)) {
    return (
      <div className="py-10 text-center text-sm text-zinc-600">Loading trip…</div>
    );
  }

  if (!scheduledDays.length) {
    return (
      <div className="py-10 text-center text-sm text-zinc-600">
        No scheduled days yet.
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto pb-2">
      <MonthCalendar
        days={scheduledDays}
        selectedDateISO={selectedDay?.date ?? scheduledDays[0]!.date}
        tripDates={
          trip
            ? { startDate: trip.trip.startDate, endDate: trip.trip.endDate }
            : undefined
        }
        itemCountByDayId={itemCountByDayId}
        firstItemTitleByDayId={firstItemTitleByDayId}
        onSelectDate={(dateISO) => {
          router.push(`/app/today?date=${encodeURIComponent(dateISO)}`);
        }}
      />
    </div>
  );
}

export function CalendarClient() {
  return (
    <Suspense>
      <CalendarContent />
    </Suspense>
  );
}
