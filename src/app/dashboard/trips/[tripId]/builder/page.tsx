import { BuilderClient } from "@/components/host/builder/BuilderClient";

export default async function BuilderPage({
  params,
}: {
  params: Promise<{ tripId: string }>;
}) {
  const { tripId } = await params;
  return <BuilderClient tripId={tripId} />;
}
