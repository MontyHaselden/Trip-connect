import { redirect } from "next/navigation";
import { Suspense } from "react";

import { BuilderClient } from "@/components/host/builder/BuilderClient";
import { getHostSession } from "@/lib/auth/host-session";
import { getTripDashboardContext } from "@/lib/host/get-trip-dashboard-context";

export default async function BuilderPage({
  params,
}: {
  params: Promise<{ tripId: string }>;
}) {
  const { tripId } = await params;
  const session = await getHostSession();
  if (!session) redirect("/login");

  const context = await getTripDashboardContext(session.hostId, tripId);
  if (!context) redirect("/dashboard");

  if (context.lifecycle.wizardInProgress && context.lifecycle.wizardStep) {
    redirect(`/dashboard/trips/${tripId}/wizard?step=${context.lifecycle.wizardStep}`);
  }

  return (
    <Suspense fallback={<p className="p-10 text-sm text-zinc-600">Loading builder…</p>}>
      <BuilderClient tripId={tripId} />
    </Suspense>
  );
}
