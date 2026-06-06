import { AccommodationClient } from "@/components/host/accommodation/AccommodationClient";
import { getHostSession } from "@/lib/auth/host-session";
import { getTripByIdForHost } from "@/lib/host/get-trip-by-id";
import { redirect } from "next/navigation";

export default async function TripAccommodationPage({
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
    <div className="mx-auto max-w-5xl px-5 py-10">
      <AccommodationClient tripId={tripId} inviteCode={trip.inviteCode} />
    </div>
  );
}
