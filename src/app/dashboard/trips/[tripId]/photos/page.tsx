import { TripPhotosClient } from "@/components/dashboard/TripPhotosClient";

export default async function DashboardPhotosPage({
  params,
}: {
  params: Promise<{ tripId: string }>;
}) {
  const { tripId } = await params;
  return (
    <div className="mx-auto max-w-5xl px-5 py-8">
      <TripPhotosClient tripId={tripId} />
    </div>
  );
}
