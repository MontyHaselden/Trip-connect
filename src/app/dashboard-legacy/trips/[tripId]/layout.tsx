import { redirect } from "next/navigation";

import { TripRouteShell } from "@/components/dashboard/TripRouteShell";
import { getHostSession } from "@/lib/auth/host-session";
import { getTripDashboardContext } from "@/lib/host/get-trip-dashboard-context";
import { TRIP_STATUS_LABELS } from "@/lib/host/trip-lifecycle";

export default async function TripDashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tripId: string }>;
}) {
  const { tripId } = await params;
  const session = await getHostSession();
  if (!session) redirect("/login");

  const context = await getTripDashboardContext(session.hostId, tripId);
  if (!context) redirect("/dashboard");

  const { trip, lifecycle } = context;

  return (
    <TripRouteShell
      tripId={tripId}
      tripName={trip.name}
      tripStatus={lifecycle.status}
      tripStatusLabel={TRIP_STATUS_LABELS[lifecycle.status]}
      continuePath={lifecycle.continuePath}
      wizardInProgress={lifecycle.wizardInProgress}
    >
      {children}
    </TripRouteShell>
  );
}
