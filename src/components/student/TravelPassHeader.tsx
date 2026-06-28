"use client";

import { DateTime } from "luxon";

import { useTripApp } from "@/components/layout/TripAppContext";
import { StudentSyncStatus } from "@/components/student/StudentSyncStatus";
import { DayLocationButton } from "@/components/student/today/DayLocationSheet";
import { formatHeaderWeatherLine } from "@/lib/weather/format-header-weather";

import { PreviewDayLocationPin } from "./PreviewDayLocationPin";

export function TravelPassDateHeader() {
  const { todayNav, todayDayMeta, cache } = useTripApp();

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
        <div className="flex items-center justify-center gap-1.5">
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

/** @deprecated Use TravelPassDateHeader + StudentDayNavBar */
export function TravelPassHeader() {
  return <TravelPassDateHeader />;
}
