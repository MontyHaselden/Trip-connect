import { MobilePeopleClient } from "@/components/mobile/MobilePeopleClient";
import { getHostSession } from "@/lib/auth/host-session";
import { getTripByIdForHost } from "@/lib/host/get-trip-by-id";
import { redirect } from "next/navigation";

export default async function MobileAdminPeoplePage({
  params,
}: {
  params: Promise<{ tripId: string }>;
}) {
  const { tripId } = await params;
  const session = await getHostSession();
  if (!session) redirect("/login");
  const trip = await getTripByIdForHost(session.hostId, tripId);
  if (!trip) redirect("/dashboard");

  return <MobilePeopleClient inviteCode={trip.inviteCode} />;
}
