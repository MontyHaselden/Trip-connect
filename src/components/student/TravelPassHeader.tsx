"use client";

import { DateTime } from "luxon";

import { useTripApp } from "@/components/layout/TripAppContext";
import { StudentSyncStatus } from "@/components/student/StudentSyncStatus";
import { DayLocationButton } from "@/components/student/today/DayLocationSheet";
import { formatHeaderWeatherLine } from "@/lib/weather/format-header-weather";

import { PreviewDayLocationPin } from "./PreviewDayLocationPin";

function CalendarIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      className="h-4 w-4"
      aria-hidden
    >
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}

export function TravelPassHeader() {
  const { todayNav, todayDayMeta, setCalendarOpen, cache } = useTripApp();

  if (!todayNav || !todayDayMeta) return null;

  const dt = DateTime.fromISO(todayDayMeta.dateISO, {
    zone: todayDayMeta.tripTimezone,
  });
  const dateLine = dt.toFormat("cccc d MMMM");
  const weatherLine = formatHeaderWeatherLine(todayDayMeta.weather);
  const showPreviewPin = !cache.payload && todayDayMeta.previewNightStay !== undefined;

  const showError =
    cache.status === "error" || cache.status === "unauthorized";

  return (
    <header className="shrink-0 border-b border-[var(--student-line)] pb-3 pt-0.5">
      <div className="text-center">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={todayNav.goPrev}
            disabled={!todayNav.canGoPrev}
            className="flex h-9 w-9 items-center justify-center rounded-full text-lg text-[var(--student-text)] disabled:opacity-30"
            aria-label="Previous day"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => setCalendarOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-full border border-[var(--student-line)] bg-[var(--student-surface)] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--student-text-muted)]"
          >
            <CalendarIcon />
            Calendar
          </button>
          <button
            type="button"
            onClick={todayNav.goNext}
            disabled={!todayNav.canGoNext}
            className="flex h-9 w-9 items-center justify-center rounded-full text-lg text-[var(--student-text)] disabled:opacity-30"
            aria-label="Next day"
          >
            ›
          </button>
        </div>

        <div className="mt-2 flex items-center justify-center gap-1.5">
          <h1 className="text-lg font-semibold tracking-tight text-[var(--student-text)]">
            {dateLine}
          </h1>
          {showPreviewPin ? (
            <PreviewDayLocationPin
              date={todayDayMeta.dateISO}
              cityLabel={todayDayMeta.cityLabel}
              nightStay={todayDayMeta.previewNightStay ?? null}
            />
          ) : (
            <DayLocationButton placement="header" />
          )}
        </div>

        {weatherLine ? (
          <p className="mt-1 text-xs leading-snug text-[var(--student-text-muted)]">
            {weatherLine}
          </p>
        ) : null}
      </div>

      {showError ? (
        <div className="mt-2">
          <StudentSyncStatus
            online={cache.online}
            cachedAt={cache.cachedAt}
            version={cache.version}
            status={cache.status}
            message={
              cache.status === "unauthorized"
                ? "Could not refresh — your session may have expired. You can still view saved trip data."
                : cache.message
            }
          />
        </div>
      ) : null}
    </header>
  );
}
