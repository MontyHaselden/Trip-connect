import { ItineraryClient } from "@/components/host/itinerary/ItineraryClient";

export default function HostItineraryPage({
  params,
}: {
  params: { inviteCode: string };
}) {
  return <ItineraryClient inviteCode={params.inviteCode} />;
}
