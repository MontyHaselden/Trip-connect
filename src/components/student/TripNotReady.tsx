"use client";

export function TripNotReady(props: { title: string; hasJoined?: boolean }) {
  const { title, hasJoined } = props;

  return (
    <div className="py-16 text-center">
      <h2 className="sr-only">{title}</h2>
      {hasJoined ? (
        <>
          <p className="text-sm font-medium text-[var(--student-text)]">
            You&apos;ve joined this trip
          </p>
          <p className="mt-2 text-sm text-[var(--student-text-muted)]">
            Your organiser hasn&apos;t shared the itinerary yet. When they push an
            update, your trip will appear here automatically.
          </p>
        </>
      ) : (
        <>
          <p className="text-sm font-medium text-[var(--student-text)]">
            Your teachers are still preparing the trip
          </p>
          <p className="mt-2 text-sm text-[var(--student-text-muted)]">
            Your trip will appear here automatically when it is ready.
          </p>
        </>
      )}
    </div>
  );
}
