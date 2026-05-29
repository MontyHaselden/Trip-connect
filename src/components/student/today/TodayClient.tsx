"use client";

import { Suspense, useEffect, useMemo } from "react";

import { useTripApp } from "@/components/layout/TripAppContext";
import { useSelectedTripDay } from "@/hooks/useSelectedTripDay";
import type { ParticipantFilteredTripV1 } from "@/lib/publish/filter-for-participant";
import { daysUntilTrip } from "@/lib/utils/time";
import { TripNotReady } from "@/components/student/TripNotReady";
import { ItineraryList } from "@/components/student/today/ItineraryList";
import { TodayBuildingBanner } from "@/components/student/today/TodayBuildingBanner";

function isTripPayload(x: unknown): x is ParticipantFilteredTripV1 {
  if (!x || typeof x !== "object") return false;
  const o = x as { trip?: unknown; days?: unknown; itineraryItems?: unknown };
  return Boolean(o.trip && o.days && o.itineraryItems);
}

function TodayContent() {
  const { cache, setTodayNav } = useTripApp();
  const trip = isTripPayload(cache.payload) ? cache.payload : null;

  const tripNotPublished =
    cache.version === 0 ||
    (cache.version === null &&
      !trip &&
      (cache.status === "up_to_date" || cache.status === "ready"));

  const tripTz = trip?.trip.timezone ?? "UTC";
  const tripDates = trip
    ? { startDate: trip.trip.startDate, endDate: trip.trip.endDate }
    : undefined;

  const {
    scheduledDays,
    selectedDay,
    isViewingToday,
    goNext,
    goPrev,
    canGoPrev,
    canGoNext,
    setDate,
  } = useSelectedTripDay(trip?.days ?? [], tripTz, tripDates);

  useEffect(() => {
    if (!selectedDay || !scheduledDays.length) {
      setTodayNav(null);
      return;
    }
    setTodayNav({
      scheduledDays,
      selectedDateISO: selectedDay.date,
      canGoPrev,
      canGoNext,
      goPrev,
      goNext,
      setDate,
    });
    return () => setTodayNav(null);
  }, [
    scheduledDays,
    selectedDay,
    canGoPrev,
    canGoNext,
    goPrev,
    goNext,
    setDate,
    setTodayNav,
  ]);

  const dayItems = useMemo(() => {
    if (!trip || !selectedDay) return [];
    return trip.itineraryItems
      .filter((i) => i.tripDayId === selectedDay.id)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }, [trip, selectedDay]);

  const prepItems = useMemo(() => {
    if (!trip || !selectedDay) return [];
    return trip.tomorrowPrepItems
      .filter((p) => p.tripDayId === selectedDay.id)
      .sort((a, b) => a.sortOrder - b.sortOrder);
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

  if (!trip) {
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

  const daysUntil =
    selectedDay.date < trip.trip.startDate
      ? daysUntilTrip({
          startDate: trip.trip.startDate,
          dateISO: selectedDay.date,
          tripTimezone: tripTz,
        })
      : null;

  const hasContent = dayItems.length > 0 || prepItems.length > 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden pb-2">
      <div className="shrink-0">
        <Suspense>
          <TodayBuildingBanner />
        </Suspense>
      </div>

      {hasContent ? (
        <ItineraryList
          items={dayItems}
          tripTimezone={tripTz}
          dateISO={selectedDay.date}
          mapsOnline={cache.online}
          isViewingToday={isViewingToday}
          prepItems={prepItems}
        />
      ) : (
        <div className="flex flex-1 items-center justify-center py-8 text-center">
          <div>
            <p className="text-sm font-medium text-zinc-800">No event today</p>
            {typeof daysUntil === "number" && daysUntil > 0 ? (
              <p className="mt-2 text-sm text-zinc-500">
                {daysUntil} day{daysUntil === 1 ? "" : "s"} until trip
              </p>
            ) : null}
          </div>
        </div>
      )}
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
