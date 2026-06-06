import { redirect } from "next/navigation";

import { MobileAdminShell } from "@/components/mobile/MobileAdminShell";
import { getHostSession } from "@/lib/auth/host-session";
import { getTripByIdForHost } from "@/lib/host/get-trip-by-id";

export default async function MobileAdminTripLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tripId: string }>;
}) {
  const { tripId } = await params;
  const session = await getHostSession();
  if (!session) redirect("/login");

  const trip = await getTripByIdForHost(session.hostId, tripId);
  if (!trip) redirect("/dashboard");

  return (
    <MobileAdminShell tripId={tripId} tripName={trip.name}>
      {children}
    </MobileAdminShell>
  );
}
