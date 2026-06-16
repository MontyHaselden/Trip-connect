import { redirect } from "next/navigation";

import { tripOsSetupPath } from "@/lib/trip-os/paths";

/** Legacy viewers URL — use Trip OS. */
export default async function DashboardViewersPage({
  params,
}: {
  params: Promise<{ tripId: string }>;
}) {
  const { tripId } = await params;
  redirect(tripOsSetupPath(tripId));
}
