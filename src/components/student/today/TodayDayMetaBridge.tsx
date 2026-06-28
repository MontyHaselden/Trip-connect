"use client";

import { useEffect, useMemo } from "react";
import { DateTime } from "luxon";

import { useTripApp } from "@/components/layout/TripAppContext";
import type { TodayDayMeta } from "@/components/layout/TripAppContext";
import { resolveStudentTripPayload } from "@/lib/student/resolve-trip-payload";

export function TodayDayMetaBridge() {
  const { cache, todayNav, setTodayDayMeta } = useTripApp();
  const trip = useMemo(
    () => resolveStudentTripPayload(cache.payload, cache.participantId),
    [cache.payload, cache.participantId],
  );

  const tripTz = trip?.trip.timezone ?? "UTC";

  const selectedDay = useMemo(() => {
    if (!todayNav?.selectedDateISO || !trip?.days?.length) return null;
    return trip.days.find((d) => d.date === todayNav.selectedDateISO) ?? null;
  }, [todayNav, trip?.days]);

  const isViewingToday = useMemo(() => {
    if (!selectedDay) return false;
    const todayISO = DateTime.now().setZone(tripTz).toISODate();
    return selectedDay.date === todayISO;
  }, [selectedDay, tripTz]);

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
