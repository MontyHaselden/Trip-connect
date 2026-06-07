"use client";

import { Suspense, useEffect, useMemo } from "react";

import { useTripApp } from "@/components/layout/TripAppContext";
import { useSelectedTripDay } from "@/hooks/useSelectedTripDay";
import {
  hasTodaySchedule,
  resolveStudentTripPayload,
} from "@/lib/student/resolve-trip-payload";
import { TripNotReady } from "@/components/student/TripNotReady";
import {
  stayColor,
  stayForNight,
} from "@/lib/host/locations/accommodation-colors";
import { sortItemsByStartTime } from "@/lib/timeline/time-math";
import { TodayBuildingBanner } from "@/components/student/today/TodayBuildingBanner";
import { CompactDaySheet } from "@/components/student/today/CompactDaySheet";

function TodayContent() {
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

  const { scheduledDays, selectedDay, isViewingToday } = useSelectedTripDay(
    trip?.days ?? [],
    tripTz,
    tripDates,
  );

  useEffect(() => {
    if (!selectedDay?.date) return;
    try {
      sessionStorage.setItem("tc_last_date", selectedDay.date);
    } catch {
      // ignore
    }
  }, [selectedDay?.date]);

  const dayItems = useMemo(() => {
    if (!trip || !selectedDay) return [];
    return sortItemsByStartTime(
      trip.itineraryItems.filter((i) => i.tripDayId === selectedDay.id),
    );
  }, [trip, selectedDay]);

  const prepItems = useMemo(() => {
    if (!trip || !selectedDay) return [];
    return trip.tomorrowPrepItems
      .filter((p) => p.tripDayId === selectedDay.id)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }, [trip, selectedDay]);

  const nightStay = useMemo(() => {
    if (!trip || !selectedDay) return null;
    const stay = stayForNight(selectedDay.date, trip.accommodationStays ?? []);
    if (!stay) return null;
    return {
      name: stay.name,
      color: stayColor(stay),
    };
  }, [trip, selectedDay]);

  if (cache.status === "offline_no_cache") {
    return (
      <div className="py-6 text-center text-sm text-zinc-600">
        Connect to the internet once to download the trip.
      </div>
    );
  }

  if (tripNotPublished && !trip) {
    return <TripNotReady title="Today" />;
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

  if (!selectedDay) {
    return (
      <div className="py-10 text-center text-sm text-zinc-600">
        Select a day from the calendar.
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="shrink-0">
        <Suspense>
          <TodayBuildingBanner />
        </Suspense>
      </div>

      <CompactDaySheet
        items={dayItems}
        prepItems={prepItems}
        tripTimezone={tripTz}
        dateISO={selectedDay.date}
        cityLabel={selectedDay.cityLabel}
        weather={selectedDay.weather}
        tripStartDate={trip.trip.startDate}
        isViewingToday={isViewingToday}
        mapsOnline={cache.online}
        nightStay={nightStay}
      />
    </div>
  );
}

export function TodayClient() {
  return (
    <Suspense>
      <TodayContent />
    </Suspense>
  );
}
