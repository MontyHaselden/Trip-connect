import { JoinBoardClient } from "@/components/join/JoinBoardClient";
import { loadTripByAnyInviteCode } from "@/lib/join/load-trip-by-invite";
import { notFound } from "next/navigation";

export default async function JoinDisplayPage(props: {
  params: Promise<{ inviteCode: string }>;
}) {
  const { inviteCode } = await props.params;
  const trip = await loadTripByAnyInviteCode(inviteCode);
  if (!trip) notFound();

  return (
    <JoinBoardClient
      inviteCode={trip.tripInviteCode}
      tripName={trip.name}
    />
  );
}
