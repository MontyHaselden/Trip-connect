import { redirect } from "next/navigation";

import { TripOsBoardEntry } from "@/components/trip-os/TripOsBoardEntry";
import { getHostSession } from "@/lib/auth/host-session";
import { getTripByIdForHost } from "@/lib/host/get-trip-by-id";

export default async function DashboardTripPage(props: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await props.params;
  const session = await getHostSession();
  if (!session) redirect("/login");

  const trip = await getTripByIdForHost(session.hostId, tripId);
  if (!trip) redirect("/dashboard");

  return <TripOsBoardEntry tripId={tripId} />;
}
