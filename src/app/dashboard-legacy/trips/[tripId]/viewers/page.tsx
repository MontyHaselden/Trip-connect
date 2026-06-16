import { TripViewersClient } from "@/components/dashboard/TripViewersClient";

export default async function DashboardViewersPage({
  params,
}: {
  params: Promise<{ tripId: string }>;
}) {
  const { tripId } = await params;
  return (
    <div className="mx-auto max-w-5xl px-5 py-8">
      <TripViewersClient tripId={tripId} />
    </div>
  );
}
