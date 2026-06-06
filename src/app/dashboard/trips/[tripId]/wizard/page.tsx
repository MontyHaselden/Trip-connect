import { redirect } from "next/navigation";

import { WizardClient } from "@/components/host/wizard/WizardClient";
import { getHostSession } from "@/lib/auth/host-session";
import { getTripByIdForHost } from "@/lib/host/get-trip-by-id";

export default async function TripWizardPage({
  params,
  searchParams,
}: {
  params: Promise<{ tripId: string }>;
  searchParams: Promise<{ step?: string }>;
}) {
  const { tripId } = await params;
  const { step } = await searchParams;
  const initialStep = Math.min(8, Math.max(1, Number(step) || 1));

  const session = await getHostSession();
  if (!session) redirect("/login");

  const trip = await getTripByIdForHost(session.hostId, tripId);
  if (!trip) redirect("/dashboard");

  return (
    <WizardClient
      tripId={tripId}
      initialStep={initialStep}
      initialTripName={trip.name}
    />
  );
}
