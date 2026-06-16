"use client";

import { useTripApp } from "@/components/layout/TripAppContext";

export function StudentDayNavBar() {
  const { todayNav } = useTripApp();

  if (!todayNav) return null;

  return (
    <nav className="shrink-0 border-t border-[var(--student-line)] bg-[var(--student-bg)] px-1 pt-2">
      <div className="flex items-stretch gap-1">
        <button
          type="button"
          onClick={todayNav.goPrev}
          disabled={!todayNav.canGoPrev}
          className="flex min-h-10 flex-1 items-center justify-center rounded-full px-2 text-xs font-semibold text-[var(--student-text)] disabled:opacity-30"
        >
          ‹ Previous day
        </button>
        <button
          type="button"
          onClick={todayNav.goNext}
          disabled={!todayNav.canGoNext}
          className="flex min-h-10 flex-1 items-center justify-center rounded-full px-2 text-xs font-semibold text-[var(--student-text)] disabled:opacity-30"
        >
          Next day ›
        </button>
      </div>
    </nav>
  );
}
