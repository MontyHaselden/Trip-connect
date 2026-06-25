"use client";

import { Suspense, useEffect, useMemo } from "react";

import { useTripApp } from "@/components/layout/TripAppContext";
import { useSelectedTripDay } from "@/hooks/useSelectedTripDay";
import {
  hasTodaySchedule,
  resolveStudentTripPayload,
} from "@/lib/student/resolve-trip-payload";
import {
  isTripCacheLoading,
  isTripConnectionError,
  TRIP_CONNECTION_ERROR_MESSAGE,
} from "@/lib/student/trip-load-state";
import { TripNotReady } from "@/components/student/TripNotReady";
import {
  stayColor,
} from "@/lib/host/locations/accommodation-colors";
import { resolveAccommodationForDate } from "@/lib/student/resolve-accommodation-for-date";
import { sortItemsByStartTime } from "@/lib/timeline/time-math";
import { TodayBuildingBanner } from "@/components/student/today/TodayBuildingBanner";
import { CompactDaySheet } from "@/components/student/today/CompactDaySheet";
import { TodayDayMetaBridge } from "@/components/student/today/TodayDayMetaBridge";

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

  const dayReminders = useMemo(() => {
    if (!trip || !selectedDay) return [];
    return (trip.dayReminders ?? [])
      .filter((r) => r.tripDayId === selectedDay.id)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }, [trip, selectedDay]);

  const nightStay = useMemo(() => {
    if (!trip || !selectedDay || !cache.participantId) return null;
    const acc = resolveAccommodationForDate(trip, cache.participantId, selectedDay.date);
    if (!acc?.name) return null;
    return {
      name: acc.name,
      color: stayColor({
        name: acc.name,
        cityLabel: acc.cityLabel ?? selectedDay.cityLabel,
      }),
    };
  }, [trip, selectedDay, cache.participantId]);

  if (isTripCacheLoading(cache)) {
    return (
      <div className="py-10 text-center text-sm text-[var(--student-text-muted)]">Loading trip…</div>
    );
  }

  if (isTripConnectionError(cache)) {
    return (
      <div className="py-10 text-center text-sm text-[var(--student-text-muted)]">
        {cache.message ?? TRIP_CONNECTION_ERROR_MESSAGE}
      </div>
    );
  }

  if (tripNotPublished && !trip) {
    return (
      <TripNotReady title="Today" hasJoined={Boolean(cache.participantId)} />
    );
  }

  if (!trip) {
    return (
      <div className="py-10 text-center text-sm text-[var(--student-text-muted)]">
        Could not load trip preview.
      </div>
    );
  }

  if (!hasTodaySchedule(trip)) {
    if (!trip.days?.length) {
      return (
        <div className="py-10 text-center text-sm text-[var(--student-text-muted)]">
          No scheduled days yet.
        </div>
      );
    }
    return (
      <div className="py-10 text-center text-sm text-[var(--student-text-muted)]">
        Nothing scheduled for this view yet.
      </div>
    );
  }

  if (!scheduledDays.length) {
    return (
      <div className="py-10 text-center text-sm text-[var(--student-text-muted)]">
        No scheduled days yet.
      </div>
    );
  }

  if (!selectedDay) {
    return (
      <div className="py-10 text-center text-sm text-[var(--student-text-muted)]">
        Select a day from the calendar.
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <TodayDayMetaBridge />
      <div className="shrink-0">
        <Suspense>
          <TodayBuildingBanner />
        </Suspense>
      </div>

      <CompactDaySheet
        items={dayItems}
        prepItems={prepItems}
        dayReminders={dayReminders}
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
