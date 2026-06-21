"use client";

export function TripNotReady(props: {
  title: string;
  hasJoined?: boolean;
  pendingHostUpdate?: boolean;
}) {
  const { title, hasJoined, pendingHostUpdate } = props;

  return (
    <div className="py-16 text-center">
      <h2 className="sr-only">{title}</h2>
      {hasJoined ? (
        <>
          <p className="text-sm font-medium text-[var(--student-text)]">
            You&apos;ve joined this trip
          </p>
          <p className="mt-2 text-sm text-[var(--student-text-muted)]">
            {pendingHostUpdate
              ? "Your organiser needs to tap Update participants in Trip OS so your screen catches up — then reopen the app."
              : "Your organiser hasn't shared the itinerary yet. When they push an update, your trip will appear here automatically."}
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
