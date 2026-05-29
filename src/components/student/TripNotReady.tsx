"use client";

export function TripNotReady(props: { title: string }) {
  const { title } = props;

  return (
    <main className="flex flex-col gap-4 py-2">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      <div className="rounded-2xl border border-zinc-200 bg-white p-5">
        <p className="text-sm font-medium text-zinc-900">
          Your teachers are still preparing the trip
        </p>
        <p className="mt-2 text-sm text-zinc-600">
          You&apos;re connected on this phone. Tap the refresh icon above to
          download the itinerary, contacts, and emergency phrases when ready.
        </p>
      </div>
    </main>
  );
}
