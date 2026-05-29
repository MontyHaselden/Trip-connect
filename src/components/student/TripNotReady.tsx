"use client";

export function TripNotReady(props: { title: string }) {
  const { title } = props;

  return (
    <main className="py-16 text-center">
      <h2 className="sr-only">{title}</h2>
      <p className="text-sm font-medium text-zinc-800">
        Your teachers are still preparing the trip
      </p>
      <p className="mt-2 text-sm text-zinc-500">
        Tap refresh above when the itinerary is ready.
      </p>
    </main>
  );
}
