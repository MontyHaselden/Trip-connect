"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { useTripApp } from "@/components/layout/TripAppContext";
import { stayColor } from "@/lib/host/locations/accommodation-colors";
import { resolveAccommodationForDate } from "@/lib/student/resolve-accommodation-for-date";
import { resolveStudentTripPayload } from "@/lib/student/resolve-trip-payload";
import { studentDayLocationLabel } from "@/lib/student/student-day-location";

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

export function DayLocationButton(props: { placement?: "header" | "nav" }) {
  const placement = props.placement ?? "nav";
  const { cache, todayNav } = useTripApp();
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (anchorRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const trip = useMemo(
    () => resolveStudentTripPayload(cache.payload, cache.participantId),
    [cache.payload, cache.participantId],
  );

  if (!todayNav || !trip || !cache.participantId) return null;

  const selected = todayNav.scheduledDays.find(
    (d) => d.date === todayNav.selectedDateISO,
  );
  if (!selected) return null;

  const dayMeta = trip.days.find((d) => d.id === selected.id);
  const locationLabel = dayMeta
    ? studentDayLocationLabel(dayMeta)
    : studentDayLocationLabel(selected);

  const accommodation = resolveAccommodationForDate(
    trip,
    cache.participantId,
    selected.date,
    { dayCityLabel: locationLabel },
  );

  const hotelItem = trip.itineraryItems.find(
    (i) => i.tripDayId === selected.id && i.category === "hotel",
  );

  const hotelName =
    accommodation?.name ?? hotelItem?.locationName ?? hotelItem?.title ?? null;

  const hotelAddress = accommodation?.address ?? hotelItem?.address ?? null;

  const popupClass =
    placement === "header"
      ? "absolute top-full right-0 z-30 mt-2 w-64 rounded-xl border border-[var(--student-line)] bg-[var(--student-surface)] p-4 text-left shadow-lg"
      : "absolute bottom-full right-0 z-30 mb-2 w-64 rounded-xl border border-[var(--student-line)] bg-[var(--student-surface)] p-4 text-left shadow-lg";

  const summaryClass =
    placement === "header"
      ? "inline-flex cursor-pointer list-none items-center justify-center rounded-lg p-1 text-[var(--student-text-muted)] marker:content-none hover:bg-[var(--student-line)]/40 hover:text-[var(--student-text)]"
      : "flex cursor-pointer list-none items-center justify-center rounded-lg px-2 py-2 text-[var(--student-text-muted)] marker:content-none hover:bg-[var(--student-line)]/40";

  return (
    <div ref={anchorRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className={summaryClass}
      >
        <PinIcon />
        <span className="sr-only">Location and accommodation for this day</span>
      </button>
      {open ? (
        <div className={popupClass}>
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--student-text-muted)]">
            {selected.date}
          </p>
          <p className="mt-1 text-sm font-semibold text-[var(--student-text)]">{locationLabel}</p>
          <div className="mt-3 border-t border-[var(--student-line)] pt-3">
            <p className="text-xs font-medium text-[var(--student-text-muted)]">Accommodation</p>
            {hotelName ? (
              <>
                <p className="mt-1 flex items-center gap-2 text-sm text-[var(--student-text)]">
                  {accommodation?.name ? (
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{
                        backgroundColor: stayColor({
                          name: accommodation.name,
                          cityLabel: accommodation.cityLabel ?? locationLabel,
                        }),
                      }}
                      aria-hidden
                    />
                  ) : null}
                  {hotelName}
                </p>
                {hotelAddress ? (
                  <p className="mt-0.5 text-xs text-zinc-600">{hotelAddress}</p>
                ) : null}
              </>
            ) : (
              <p className="mt-1 text-sm text-zinc-500">Not set yet</p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
