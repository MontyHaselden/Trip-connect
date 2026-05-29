"use client";

import { useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { DateTime } from "luxon";

import {
  getTripPhase,
  isTripEve,
  type TripPhase,
} from "@/lib/utils/time";

type Day = { id: string; date: string; cityLabel: string; sortOrder: number };

export function useSelectedTripDay(
  days: Day[],
  tripTimezone: string,
  tripDates?: { startDate: string; endDate: string },
) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();

  const dateParam = search.get("date");

  const daysByDate = useMemo(() => {
    const m = new Map<string, Day>();
    for (const d of days) m.set(d.date, d);
    return m;
  }, [days]);

  const sortedDays = useMemo(
    () => [...days].sort((a, b) => a.sortOrder - b.sortOrder),
    [days],
  );

  const firstDay = sortedDays[0] ?? null;

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

  const tripEve = useMemo(() => {
    if (!tripDates || phase !== "pre") return false;
    return isTripEve({ startDate: tripDates.startDate, tripTimezone });
  }, [tripDates, phase, tripTimezone]);

  const selected = useMemo(() => {
    if (dateParam && daysByDate.has(dateParam)) {
      return daysByDate.get(dateParam)!;
    }

    if (phase === "pre") {
      return null;
    }

    if (phase === "active") {
      if (todayISO && daysByDate.has(todayISO)) {
        return daysByDate.get(todayISO)!;
      }
      return firstDay;
    }

    if (todayISO && daysByDate.has(todayISO)) {
      return daysByDate.get(todayISO)!;
    }
    return sortedDays.at(-1) ?? null;
  }, [dateParam, daysByDate, firstDay, phase, sortedDays, todayISO]);

  function setDate(dateISO: string) {
    const params = new URLSearchParams(search.toString());
    params.set("date", dateISO);
    router.replace(`${pathname}?${params.toString()}`);
  }

  function clearDate() {
    const params = new URLSearchParams(search.toString());
    params.delete("date");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }

  function goToday() {
    if (phase === "pre") {
      clearDate();
      return;
    }
    if (todayISO) setDate(todayISO);
  }

  function goTomorrow() {
    if (phase === "pre") {
      if (tripEve && firstDay) setDate(firstDay.date);
      return;
    }
    if (!selected) return;
    const dt = DateTime.fromISO(selected.date, { zone: tripTimezone }).plus({
      days: 1,
    });
    const iso = dt.toISODate();
    if (iso && daysByDate.has(iso)) setDate(iso);
  }

  function goNext() {
    if (!selected) return;
    const idx = sortedDays.findIndex((d) => d.id === selected.id);
    const next = sortedDays[idx + 1];
    if (next) setDate(next.date);
  }

  function viewDay1() {
    if (firstDay) setDate(firstDay.date);
  }

  return {
    selectedDay: selected,
    phase,
    tripEve,
    firstDay,
    setDate,
    goToday,
    goTomorrow,
    goNext,
    viewDay1,
  };
}
