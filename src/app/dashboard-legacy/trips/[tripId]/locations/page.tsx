import { LocationsClient } from "@/components/host/locations/LocationsClient";
import { getHostSession } from "@/lib/auth/host-session";
import { getTripByIdForHost } from "@/lib/host/get-trip-by-id";
import { redirect } from "next/navigation";

export default async function TripLocationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ tripId: string }>;
  searchParams: Promise<{ date?: string }>;
}) {
  const { tripId } = await params;
  const { date } = await searchParams;
  const session = await getHostSession();
  if (!session) redirect("/login");

  const trip = await getTripByIdForHost(session.hostId, tripId);
  if (!trip) redirect("/dashboard");

  return (
    <div className="mx-auto max-w-5xl px-5 py-10">
      <LocationsClient
        tripId={tripId}
        inviteCode={trip.inviteCode}
        focusDate={date ?? null}
      />
    </div>
  );
}
