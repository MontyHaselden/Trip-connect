import { redirect } from "next/navigation";

export default async function TripAccommodationPage({
  params,
}: {
  params: Promise<{ tripId: string }>;
}) {
  const { tripId } = await params;
  redirect(`/dashboard/trips/${tripId}/locations`);
}
