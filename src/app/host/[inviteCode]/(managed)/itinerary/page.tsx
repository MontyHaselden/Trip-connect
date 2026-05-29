import { Suspense } from "react";

import { ItineraryClient } from "@/components/host/itinerary/ItineraryClient";

export default function HostItineraryPage({
  params,
}: {
  params: { inviteCode: string };
}) {
  return (
    <Suspense fallback={<p className="text-sm text-zinc-600">Loading itinerary…</p>}>
      <ItineraryClient inviteCode={params.inviteCode} />
    </Suspense>
  );
}
