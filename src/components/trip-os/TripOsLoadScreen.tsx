"use client";

import { clearTripLocalDraft } from "@/lib/trip-os/local-draft";

import type { TripLoadStatus } from "./useTripOsEngine";

export function TripOsLoadScreen(props: {
  tripId: string;
  status: TripLoadStatus;
  error?: string | null;
  onRetry: () => void;
}) {
  const { status, error } = props;
  const progress = Math.min(100, Math.max(0, status.progress));

  function handleResetCache() {
    clearTripLocalDraft(props.tripId);
    try {
      for (const key of Object.keys(sessionStorage)) {
        if (key.startsWith("trip-os:draft:")) {
          sessionStorage.removeItem(key);
        }
      }
    } catch {
      // ignore
    }
    props.onRetry();
  }

  return (
    <main className="flex min-h-0 flex-1 flex-col items-center justify-center gap-5 px-6">
      <div className="w-full max-w-sm">
        <div className="mb-2 flex items-center justify-between text-xs text-zinc-500">
          <span>{status.message}</span>
          <span className="tabular-nums font-medium text-zinc-700">{Math.round(progress)}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-zinc-100">
          <div
            className="h-full rounded-full bg-violet-500 transition-[width] duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <p className="max-w-md text-center text-sm text-zinc-600">
        {error
          ? error
          : progress < 70
            ? "Fetching your trip from the server. This step should move within a few seconds."
            : "Almost there — building the calendar in the background."}
      </p>

      <div className="flex flex-col items-center gap-2">
        <button
          type="button"
          onClick={() => props.onRetry()}
          className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm hover:bg-zinc-50"
        >
          Retry load
        </button>
        <button
          type="button"
          onClick={handleResetCache}
          className="text-xs text-zinc-500 underline-offset-2 hover:text-zinc-700 hover:underline"
        >
          Clear saved browser data for this trip
        </button>
      </div>

      <p className="max-w-md text-center text-[11px] leading-relaxed text-zinc-400">
        Developer tools on Mac: <kbd className="rounded bg-zinc-100 px-1">⌘</kbd>{" "}
        <kbd className="rounded bg-zinc-100 px-1">⌥</kbd>{" "}
        <kbd className="rounded bg-zinc-100 px-1">I</kbd> (or right‑click → Inspect).
        If the page is frozen, wait for the load to finish or try another browser tab.
      </p>
    </main>
  );
}
