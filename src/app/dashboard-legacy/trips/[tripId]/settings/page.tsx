import { TripSettingsClient } from "@/components/dashboard/TripSettingsClient";

export default async function DashboardSettingsPage({
  params,
}: {
  params: Promise<{ tripId: string }>;
}) {
  const { tripId } = await params;
  return (
    <div className="mx-auto max-w-5xl px-5 py-8">
      <TripSettingsClient tripId={tripId} />
    </div>
  );
}
