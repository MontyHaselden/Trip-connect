import { redirect } from "next/navigation";

import { tripOsSetupPath } from "@/lib/trip-os/paths";

/** Legacy builder URL — Trip OS is the only host workspace. */
export default async function BuilderPage({
  params,
}: {
  params: Promise<{ tripId: string }>;
}) {
  const { tripId } = await params;
  redirect(tripOsSetupPath(tripId));
}
