"use client";

export function TripNotReady(props: {
  title: string;
  onRefresh?: () => void;
  refreshing?: boolean;
}) {
  const { title, onRefresh, refreshing } = props;

  return (
    <main className="flex flex-col gap-4 py-6">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <div className="rounded-2xl border border-zinc-200 bg-white p-5">
        <p className="text-sm font-medium text-zinc-900">
          Your teachers are still preparing the trip
        </p>
        <p className="mt-2 text-sm text-zinc-600">
          You&apos;re connected on this phone. When your trip is published, tap
          refresh to download the itinerary, contacts, and emergency phrases.
        </p>
        {onRefresh ? (
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-xl bg-zinc-900 px-4 text-sm font-medium text-white disabled:opacity-50"
          >
            {refreshing ? "Refreshing…" : "Refresh trip data"}
          </button>
        ) : null}
      </div>
    </main>
  );
}
