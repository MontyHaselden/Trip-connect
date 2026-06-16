"use client";

import { useEffect, useMemo } from "react";

import { useTripApp } from "@/components/layout/TripAppContext";
import type { TodayDayMeta } from "@/components/layout/TripAppContext";
import { useSelectedTripDay } from "@/hooks/useSelectedTripDay";
import { resolveStudentTripPayload } from "@/lib/student/resolve-trip-payload";

export function TodayDayMetaBridge() {
  const { cache, setTodayDayMeta } = useTripApp();
  const trip = useMemo(
    () => resolveStudentTripPayload(cache.payload, cache.participantId),
    [cache.payload, cache.participantId],
  );

  const tripTz = trip?.trip.timezone ?? "UTC";
  const tripDates = trip
    ? { startDate: trip.trip.startDate, endDate: trip.trip.endDate }
    : undefined;

  const { selectedDay, isViewingToday } = useSelectedTripDay(
    trip?.days ?? [],
    tripTz,
    tripDates,
  );

  useEffect(() => {
    if (!selectedDay || !trip) {
      setTodayDayMeta(null);
      return;
    }

    const meta: TodayDayMeta = {
      cityLabel: selectedDay.cityLabel,
      tripName: trip.trip.name,
      weather: selectedDay.weather,
      dateISO: selectedDay.date,
      tripTimezone: tripTz,
      isViewingToday,
    };

    setTodayDayMeta(meta);
  }, [selectedDay, trip, tripTz, isViewingToday, setTodayDayMeta]);

  useEffect(() => {
    return () => setTodayDayMeta(null);
  }, [setTodayDayMeta]);

  return null;
}
