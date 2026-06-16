import { redirect } from "next/navigation";

import { tripOsSetupPath } from "@/lib/trip-os/paths";

export default async function DashboardNextTripRedirectPage(props: {
  params: Promise<{ tripId: string }>;
}) {
  const { tripId } = await props.params;
  redirect(tripOsSetupPath(tripId));
}
