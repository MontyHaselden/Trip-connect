import { Suspense } from "react";

import { BuilderClient } from "@/components/host/builder/BuilderClient";

export default async function BuilderPage({
  params,
}: {
  params: Promise<{ tripId: string }>;
}) {
  const { tripId } = await params;
  return (
    <Suspense fallback={<p className="p-10 text-sm text-zinc-600">Loading builder…</p>}>
      <BuilderClient tripId={tripId} />
    </Suspense>
  );
}
