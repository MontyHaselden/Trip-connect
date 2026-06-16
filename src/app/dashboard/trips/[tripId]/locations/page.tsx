import { redirect } from "next/navigation";

import { tripOsSetupPath } from "@/lib/trip-os/paths";

/** Legacy locations URL — use Trip OS. */
export default async function DashboardLocationsPage({
  params,
}: {
  params: Promise<{ tripId: string }>;
}) {
  const { tripId } = await params;
  redirect(tripOsSetupPath(tripId));
}
