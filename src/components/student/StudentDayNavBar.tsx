"use client";

import { useTripApp } from "@/components/layout/TripAppContext";

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

const navBtnClass =
  "flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border border-[var(--student-line)] bg-[var(--student-surface)] px-2 text-xs font-semibold text-[var(--student-text)] transition hover:border-[var(--student-nav)] hover:bg-[var(--student-nav)]/5 disabled:cursor-not-allowed disabled:opacity-35";

export function StudentDayNavBar() {
  const { todayNav, setCalendarOpen } = useTripApp();

  if (!todayNav) return null;

  return (
    <nav className="shrink-0 border-t border-[var(--student-line)] bg-[var(--student-bg)] pt-2">
      <div className="flex items-stretch gap-2">
        <button
          type="button"
          onClick={todayNav.goPrev}
          disabled={!todayNav.canGoPrev}
          className={navBtnClass}
          aria-label="Previous day"
        >
          <span className="text-base leading-none" aria-hidden>
            ‹
          </span>
          <span>Previous</span>
        </button>
        <button
          type="button"
          onClick={() => setCalendarOpen(true)}
          className={navBtnClass}
          aria-label="Open calendar"
        >
          <CalendarIcon />
          <span>Calendar</span>
        </button>
        <button
          type="button"
          onClick={todayNav.goNext}
          disabled={!todayNav.canGoNext}
          className={navBtnClass}
          aria-label="Next day"
        >
          <span>Next</span>
          <span className="text-base leading-none" aria-hidden>
            ›
          </span>
        </button>
      </div>
    </nav>
  );
}
