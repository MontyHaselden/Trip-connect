"use client";

import { Suspense, useEffect, useMemo } from "react";

import { useTripApp } from "./TripAppContext";
import { useSelectedTripDay } from "@/hooks/useSelectedTripDay";
import { resolveStudentTripPayload } from "@/lib/student/resolve-trip-payload";

function TripDayNavBridgeInner() {
  const { cache, setTodayNav } = useTripApp();
  const trip = useMemo(
    () => resolveStudentTripPayload(cache.payload, cache.participantId),
    [cache.payload, cache.participantId],
  );

  const tripTz = trip?.trip.timezone ?? "UTC";
  const tripDates = trip
    ? { startDate: trip.trip.startDate, endDate: trip.trip.endDate }
    : undefined;

  const nav = useSelectedTripDay(trip?.days ?? [], tripTz, tripDates);

  const selectedDateISO = nav.selectedDay?.date ?? null;

  useEffect(() => {
    if (!selectedDateISO || !nav.scheduledDays.length) {
      setTodayNav(null);
      return;
    }
    setTodayNav({
      scheduledDays: nav.scheduledDays,
      selectedDateISO,
      canGoPrev: nav.canGoPrev,
      canGoNext: nav.canGoNext,
      goPrev: nav.goPrev,
      goNext: nav.goNext,
      setDate: nav.setDate,
      tripStartDate: trip?.trip.startDate ?? "",
      tripEndDate: trip?.trip.endDate ?? "",
    });
  }, [
    selectedDateISO,
    nav.scheduledDays,
    nav.canGoPrev,
    nav.canGoNext,
    nav.goPrev,
    nav.goNext,
    nav.setDate,
    setTodayNav,
    trip?.trip.startDate,
    trip?.trip.endDate,
  ]);

  useEffect(() => {
    return () => setTodayNav(null);
  }, [setTodayNav]);

  return null;
}

export function TripDayNavBridge() {
  return (
    <Suspense fallback={null}>
      <TripDayNavBridgeInner />
    </Suspense>
  );
}
