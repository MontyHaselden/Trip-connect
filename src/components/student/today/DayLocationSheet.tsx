"use client";

import { useMemo } from "react";

import { useTripApp } from "@/components/layout/TripAppContext";
import { resolveStudentTripPayload } from "@/lib/student/resolve-trip-payload";

function PinIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="h-5 w-5"
      aria-hidden
    >
      <path d="M12 21s7-4.5 7-11a7 7 0 1 0-14 0c0 6.5 7 11 7 11z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}

function resolveStayForNight(
  date: string,
  stays: Array<{
    cityLabel: string;
    name: string | null;
    address: string | null;
    checkInDate: string;
    checkOutDate: string;
  }>,
) {
  return (
    stays.find((s) => s.checkInDate <= date && s.checkOutDate >= date) ?? null
  );
}

export function DayLocationButton() {
  const { cache, todayNav } = useTripApp();
  const trip = useMemo(
    () => resolveStudentTripPayload(cache.payload, cache.participantId),
    [cache.payload, cache.participantId],
  );

  if (!todayNav || !trip) return null;

  const selected = todayNav.scheduledDays.find(
    (d) => d.date === todayNav.selectedDateISO,
  );
  if (!selected) return null;

  const dayMeta = trip.days.find((d) => d.id === selected.id);
  const locationLabel =
    dayMeta?.dayType === "travel" && dayMeta.secondaryCityLabel
      ? `${dayMeta.cityLabel} → ${dayMeta.secondaryCityLabel}`
      : dayMeta?.calendarLabel || selected.cityLabel;

  const hotelItem = trip.itineraryItems.find(
    (i) => i.tripDayId === selected.id && i.category === "hotel",
  );

  const stay = resolveStayForNight(
    selected.date,
    trip.accommodationStays ?? [],
  );

  const hotelName =
    trip.room?.hotelName ??
    stay?.name ??
    hotelItem?.locationName ??
    hotelItem?.title ??
    null;

  const hotelAddress =
    trip.room?.hotelAddress ?? stay?.address ?? hotelItem?.address ?? null;

  return (
    <details className="group relative">
      <summary className="flex cursor-pointer list-none items-center justify-center rounded-lg px-2 py-2 text-zinc-700 marker:content-none hover:bg-zinc-100">
        <PinIcon />
        <span className="sr-only">Where am I staying?</span>
      </summary>
      <div className="absolute bottom-full right-0 z-30 mb-2 w-64 rounded-xl border border-zinc-200 bg-white p-4 shadow-lg">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          {selected.date}
        </p>
        <p className="mt-1 text-sm font-semibold text-zinc-900">{locationLabel}</p>
        <div className="mt-3 border-t border-zinc-100 pt-3">
          <p className="text-xs font-medium text-zinc-500">Accommodation</p>
          {hotelName ? (
            <>
              <p className="mt-1 text-sm text-zinc-800">{hotelName}</p>
              {hotelAddress ? (
                <p className="mt-0.5 text-xs text-zinc-600">{hotelAddress}</p>
              ) : null}
            </>
          ) : (
            <p className="mt-1 text-sm text-zinc-500">Not set yet</p>
          )}
        </div>
      </div>
    </details>
  );
}
