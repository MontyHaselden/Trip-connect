import { redirect } from "next/navigation";

import { RosterClient } from "@/components/host/roster/RosterClient";
import { getHostSession } from "@/lib/auth/host-session";
import { getTripByIdForHost } from "@/lib/host/get-trip-by-id";

export default async function DashboardParticipantsPage({
  params,
}: {
  params: Promise<{ tripId: string }>;
}) {
  const { tripId } = await params;
  const session = await getHostSession();
  if (!session) redirect("/login");

  const trip = await getTripByIdForHost(session.hostId, tripId);
  if (!trip) redirect("/dashboard");

  return (
    <div className="mx-auto max-w-5xl px-5 py-8">
      <RosterClient inviteCode={trip.inviteCode} tripId={tripId} />
    </div>
  );
}
