"use client";

import { createContext, useContext } from "react";

import type { TripCacheState } from "@/hooks/useTripCache";
import type { ParticipantPhoto } from "@/lib/student/participant-photos";
import type { DayWeatherSnapshot } from "@/types/activity-category";

export type StudentAppTab = "today" | "my-trip";

export type TodayDayNav = {
  scheduledDays: Array<{
    id: string;
    date: string;
    cityLabel: string;
    calendarLabel?: string | null;
    sortOrder: number;
  }>;
  selectedDateISO: string;
  canGoPrev: boolean;
  canGoNext: boolean;
  goPrev: () => void;
  goNext: () => void;
  setDate: (dateISO: string) => void;
  tripStartDate: string;
  tripEndDate: string;
};

export type TodayDayMeta = {
  cityLabel: string;
  tripName: string;
  weather?: DayWeatherSnapshot | null;
  dateISO: string;
  tripTimezone: string;
  isViewingToday: boolean;
  /** Set in builder preview when live trip cache is unavailable. */
  previewNightStay?: { name: string | null; color: string } | null;
};

export type TripAppContextValue = {
  refresh: () => Promise<void>;
  refreshing: boolean;
  cache: TripCacheState;
  todayNav: TodayDayNav | null;
  setTodayNav: (nav: TodayDayNav | null) => void;
  todayDayMeta: TodayDayMeta | null;
  setTodayDayMeta: (meta: TodayDayMeta | null) => void;
  tripId: string;
  calendarOpen: boolean;
  setCalendarOpen: (open: boolean) => void;
  participantPhotos: ParticipantPhoto[];
  refreshPhotos: () => Promise<void>;
  studentTab: StudentAppTab;
  setStudentTab: (tab: StudentAppTab) => void;
};

export const TripAppContext = createContext<TripAppContextValue | null>(null);

export function useTripApp() {
  const ctx = useContext(TripAppContext);
  if (!ctx) {
    throw new Error("useTripApp must be used within TripAppShell or StudentTodayPreviewShell");
  }
  return ctx;
}
