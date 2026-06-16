import { redirect } from "next/navigation";

import { getHostSession } from "@/lib/auth/host-session";
import { getTripDashboardContext } from "@/lib/host/get-trip-dashboard-context";

export default async function TripHubPage({
  params,
}: {
  params: Promise<{ tripId: string }>;
}) {
  const { tripId } = await params;
  const session = await getHostSession();
  if (!session) redirect("/login");

  const context = await getTripDashboardContext(session.hostId, tripId);
  if (!context) redirect("/dashboard");

  redirect(context.lifecycle.continuePath);
}
