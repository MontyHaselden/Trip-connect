import { redirect } from "next/navigation";

import { getHostSession } from "@/lib/auth/host-session";

/** Legacy wizard URLs redirect to the Trip Setup Board. */
export default async function TripWizardPage({
  params,
}: {
  params: Promise<{ tripId: string }>;
}) {
  const { tripId } = await params;
  const session = await getHostSession();
  if (!session) redirect("/login");
  redirect(`/dashboard/trips/${tripId}/setup`);
}
