"use client";

import { useEffect, useRef, useState } from "react";

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

/** Builder preview pin — mirrors DayLocationButton when trip cache is unavailable. */
export function PreviewDayLocationPin(props: {
  date: string;
  cityLabel: string;
  nightStay: { name: string | null; color: string } | null;
}) {
  const { date, cityLabel, nightStay } = props;
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

  return (
    <div ref={anchorRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="inline-flex items-center justify-center rounded-lg p-1 text-[var(--student-text-muted)] hover:bg-[var(--student-line)]/40 hover:text-[var(--student-text)]"
      >
        <PinIcon />
        <span className="sr-only">Location and accommodation for this day</span>
      </button>
      {open ? (
        <div className="absolute top-full right-0 z-30 mt-2 w-64 rounded-xl border border-[var(--student-line)] bg-[var(--student-surface)] p-4 text-left shadow-lg">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--student-text-muted)]">
            {date}
          </p>
          <p className="mt-1 text-sm font-semibold text-[var(--student-text)]">{cityLabel}</p>
          <div className="mt-3 border-t border-[var(--student-line)] pt-3">
            <p className="text-xs font-medium text-[var(--student-text-muted)]">Accommodation</p>
            {nightStay?.name ? (
              <p className="mt-1 flex items-center gap-2 text-sm text-[var(--student-text)]">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: nightStay.color }}
                  aria-hidden
                />
                {nightStay.name}
              </p>
            ) : (
              <p className="mt-1 text-sm text-[var(--student-text-muted)]">Not set yet</p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
