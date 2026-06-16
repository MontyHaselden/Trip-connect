import { redirect } from "next/navigation";

import { tripOsSetupPath } from "@/lib/trip-os/paths";

/** Legacy photos URL — use Trip OS. */
export default async function DashboardPhotosPage({
  params,
}: {
  params: Promise<{ tripId: string }>;
}) {
  const { tripId } = await params;
  redirect(tripOsSetupPath(tripId));
}
