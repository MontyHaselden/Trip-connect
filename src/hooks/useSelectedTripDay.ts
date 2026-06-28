"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { DateTime } from "luxon";

import type { DayWeatherSnapshot } from "@/types/activity-category";
import { getTripPhase, type TripPhase } from "@/lib/utils/time";

export type ScheduleDay = {
  id: string;
  date: string;
  cityLabel: string;
  calendarLabel?: string | null;
  sortOrder: number;
  weather?: DayWeatherSnapshot | null;
};

function sortDaysByDate(days: ScheduleDay[]) {
  return [...days].sort((a, b) => a.date.localeCompare(b.date));
}

function pickDefaultDay(
  scheduledDays: ScheduleDay[],
  todayISO: string | null,
  phase: TripPhase,
): ScheduleDay | null {
  if (!scheduledDays.length) return null;

  if (phase === "active" && todayISO) {
    const today = scheduledDays.find((d) => d.date === todayISO);
    if (today) return today;
  }

  if (todayISO) {
    const upcoming = scheduledDays.find((d) => d.date >= todayISO);
    if (upcoming) return upcoming;
  }

  if (phase === "pre") {
    return scheduledDays[0] ?? null;
  }

  if (todayISO) {
    const pastOrToday = [...scheduledDays].reverse().find((d) => d.date <= todayISO);
    if (pastOrToday) return pastOrToday;
  }

  return scheduledDays[scheduledDays.length - 1] ?? null;
}

export function useSelectedTripDay(
  days: ScheduleDay[],
  tripTimezone: string,
  tripDates?: { startDate: string; endDate: string },
) {
  const pathname = usePathname();
  const search = useSearchParams();

  const dateParam = search.get("date");

  const scheduledDays = useMemo(() => sortDaysByDate(days), [days]);

  const daysByDate = useMemo(() => {
    const m = new Map<string, ScheduleDay>();
    for (const d of scheduledDays) m.set(d.date, d);
    return m;
  }, [scheduledDays]);

  const todayISO = useMemo(() => {
    return DateTime.now().setZone(tripTimezone).toISODate();
  }, [tripTimezone]);

  const phase: TripPhase = useMemo(() => {
    if (!tripDates) return "active";
    return getTripPhase({
      startDate: tripDates.startDate,
      endDate: tripDates.endDate,
      tripTimezone,
    });
  }, [tripDates, tripTimezone]);

  const defaultDateISO = useMemo(() => {
    return pickDefaultDay(scheduledDays, todayISO, phase)?.date ?? null;
  }, [scheduledDays, todayISO, phase]);

  const [activeDateISO, setActiveDateISO] = useState<string | null>(null);

  useEffect(() => {
    if (dateParam && daysByDate.has(dateParam)) {
      setActiveDateISO(dateParam);
      return;
    }
    if (defaultDateISO) {
      setActiveDateISO(defaultDateISO);
    }
  }, [dateParam, daysByDate, defaultDateISO]);

  useEffect(() => {
    function onPopState() {
      const params = new URLSearchParams(window.location.search);
      const date = params.get("date");
      if (date && daysByDate.has(date)) {
        setActiveDateISO(date);
      } else if (defaultDateISO) {
        setActiveDateISO(defaultDateISO);
      }
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [daysByDate, defaultDateISO]);

  const selectedDay = useMemo(() => {
    const iso = activeDateISO ?? dateParam ?? defaultDateISO;
    if (iso && daysByDate.has(iso)) return daysByDate.get(iso)!;
    return pickDefaultDay(scheduledDays, todayISO, phase);
  }, [activeDateISO, dateParam, defaultDateISO, daysByDate, scheduledDays, todayISO, phase]);

  const selectedIndex = selectedDay
    ? scheduledDays.findIndex((d) => d.id === selectedDay.id)
    : -1;

  const setDate = useCallback(
    (dateISO: string) => {
      if (!daysByDate.has(dateISO)) return;
      setActiveDateISO(dateISO);
      const params = new URLSearchParams(
        typeof window !== "undefined" ? window.location.search : search.toString(),
      );
      params.set("date", dateISO);
      const nextUrl = `${pathname}?${params.toString()}`;
      if (typeof window !== "undefined") {
        window.history.replaceState(window.history.state, "", nextUrl);
      }
    },
    [daysByDate, pathname, search],
  );

  const goNext = useCallback(() => {
    if (!selectedDay || selectedIndex < 0) return;
    const next = scheduledDays[selectedIndex + 1];
    if (next) setDate(next.date);
  }, [selectedDay, selectedIndex, scheduledDays, setDate]);

  const goPrev = useCallback(() => {
    if (!selectedDay || selectedIndex <= 0) return;
    const prev = scheduledDays[selectedIndex - 1];
    if (prev) setDate(prev.date);
  }, [selectedDay, selectedIndex, scheduledDays, setDate]);

  const canGoPrev = selectedIndex > 0;
  const canGoNext =
    selectedIndex >= 0 && selectedIndex < scheduledDays.length - 1;

  const isViewingToday =
    Boolean(todayISO && selectedDay && selectedDay.date === todayISO);

  return {
    scheduledDays,
    selectedDay,
    selectedIndex,
    phase,
    todayISO,
    isViewingToday,
    setDate,
    goNext,
    goPrev,
    canGoPrev,
    canGoNext,
  };
}
