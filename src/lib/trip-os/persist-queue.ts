/** Serializes trip setup writes across hook remounts (e.g. Next.js Fast Refresh). */
const queues = new Map<string, Promise<boolean>>();
const inFlightCounts = new Map<string, number>();

export function enqueueTripPersist(
  tripId: string,
  task: () => Promise<boolean>,
): Promise<boolean> {
  const prev = queues.get(tripId) ?? Promise.resolve(true);
  inFlightCounts.set(tripId, (inFlightCounts.get(tripId) ?? 0) + 1);

  const next = prev.then(task, task).finally(() => {
    const remaining = (inFlightCounts.get(tripId) ?? 1) - 1;
    if (remaining <= 0) inFlightCounts.delete(tripId);
    else inFlightCounts.set(tripId, remaining);
  });

  queues.set(
    tripId,
    next.then(
      () => true,
      () => true,
    ),
  );
  return next;
}

export function waitForTripPersist(tripId: string): Promise<boolean> {
  return queues.get(tripId) ?? Promise.resolve(true);
}

export function tripPersistInFlight(tripId: string): boolean {
  return (inFlightCounts.get(tripId) ?? 0) > 0;
}
