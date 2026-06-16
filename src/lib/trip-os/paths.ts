/** Trip OS dashboard prefix — `/dashboard` after cutover. */
export const DASHBOARD_PREFIX = "/dashboard";

export function tripOsPath(path = ""): string {
  const suffix = path.startsWith("/") ? path : path ? `/${path}` : "";
  return `${DASHBOARD_PREFIX}${suffix}`;
}

export function tripOsSetupPath(tripId: string): string {
  return `${DASHBOARD_PREFIX}/trips/${tripId}`;
}

/** Trip OS board routes — full-screen, no legacy sidebar. */
export function isTripOsBoardPath(pathname: string, tripId: string): boolean {
  const base = tripOsSetupPath(tripId);
  return pathname === base || pathname === `${base}/setup`;
}

export function tripOsNewTripPath(): string {
  return `${DASHBOARD_PREFIX}/trips/new`;
}

export function tripOsHomePath(): string {
  return DASHBOARD_PREFIX;
}

/** Rewrite legacy dashboard paths to trip-os paths. */
export function toTripOsPath(path: string): string {
  return path
    .replace(/^\/dashboard-next/, DASHBOARD_PREFIX)
    .replace(/^\/dashboard-legacy/, DASHBOARD_PREFIX)
    .replace(/^\/dashboard/, DASHBOARD_PREFIX);
}
