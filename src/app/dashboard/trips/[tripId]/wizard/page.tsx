import { redirect } from "next/navigation";

import { tripOsSetupPath } from "@/lib/trip-os/paths";

/** Legacy wizard URL — Trip OS is the only host workspace. */
export default async function TripWizardPage({
  params,
}: {
  params: Promise<{ tripId: string }>;
}) {
  const { tripId } = await params;
  redirect(tripOsSetupPath(tripId));
}
