import { Suspense } from "react";

import { ItineraryClient } from "@/components/host/itinerary/ItineraryClient";

export default async function HostItineraryPage({
  params,
}: {
  params: Promise<{ inviteCode: string }>;
}) {
  const { inviteCode } = await params;

  return (
    <Suspense fallback={<p className="text-sm text-zinc-600">Loading itinerary…</p>}>
      <ItineraryClient inviteCode={inviteCode} />
    </Suspense>
  );
}
