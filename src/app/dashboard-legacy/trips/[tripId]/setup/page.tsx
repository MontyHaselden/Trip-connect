import { redirect } from "next/navigation";

import { SetupBoardEngine } from "@/components/host/setup/SetupBoardEngine";
import { getHostSession } from "@/lib/auth/host-session";
import { getTripByIdForHost } from "@/lib/host/get-trip-by-id";
import { getAccountEffectiveLimits } from "@/lib/plans/enforce-plan";

export default async function TripSetupPage({
  params,
}: {
  params: Promise<{ tripId: string }>;
}) {
  const { tripId } = await params;
  const session = await getHostSession();
  if (!session) redirect("/login");

  const trip = await getTripByIdForHost(session.hostId, tripId);
  if (!trip) redirect("/dashboard");

  const limits = await getAccountEffectiveLimits(session.hostId);

  return (
    <SetupBoardEngine
      tripId={tripId}
      inviteCode={trip.inviteCode}
      timezone={trip.timezone}
      aiBuilderEnabled={limits?.aiBuilder ?? false}
    />
  );
}
