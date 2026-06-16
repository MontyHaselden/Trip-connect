import { redirect } from "next/navigation";

import { getValidHostSession } from "@/lib/auth/host-session";
import { getTripByIdForHost } from "@/lib/host/get-trip-by-id";

export default async function TripDashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tripId: string }>;
}) {
  const { tripId } = await params;
  const session = await getValidHostSession();
  if (!session) redirect("/login");

  const trip = await getTripByIdForHost(session.hostId, tripId);
  if (!trip) redirect("/dashboard");

  return <div className="h-dvh min-h-0 overflow-hidden bg-white">{children}</div>;
}
