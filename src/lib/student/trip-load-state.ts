export const TRIP_CONNECTION_ERROR_MESSAGE =
  "Error connecting — check your wifi or date connection.";

type TripLoadStatus =
  | "idle"
  | "loading_cache"
  | "ready"
  | "offline_no_cache"
  | "syncing"
  | "updated"
  | "up_to_date"
  | "unauthorized"
  | "error";

export function isTripCacheLoading(cache: {
  sessionReady: boolean;
  status: TripLoadStatus;
}): boolean {
  if (!cache.sessionReady) return true;
  return (
    cache.status === "idle" ||
    cache.status === "loading_cache" ||
    cache.status === "syncing"
  );
}

export function isTripConnectionError(cache: { status: TripLoadStatus }): boolean {
  return cache.status === "offline_no_cache" || cache.status === "error";
}
