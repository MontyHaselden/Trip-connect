import { tripOsSetupPath } from "@/lib/trip-os/paths";

/** Dashboard path helpers (post-cutover: dashboard1 promoted to /dashboard). */
export function toDashboardPath(path: string): string {
  return path.replace(/^\/dashboard1/, "/dashboard").replace(/^\/dashboard-legacy/, "/dashboard");
}

export function dashboardSetupPath(tripId: string): string {
  return tripOsSetupPath(tripId);
}

export function dashboardBuilderPath(tripId: string): string {
  return `/dashboard/trips/${tripId}/builder`;
}

/** @deprecated */
export const toDashboard1Path = toDashboardPath;
export const dashboard1SetupPath = dashboardSetupPath;
export const dashboard1BuilderPath = dashboardBuilderPath;
