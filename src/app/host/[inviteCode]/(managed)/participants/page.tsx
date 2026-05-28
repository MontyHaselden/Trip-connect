import { RosterClient } from "@/components/host/roster/RosterClient";

export default function HostParticipantsPage({
  params,
}: {
  params: { inviteCode: string };
}) {
  return <RosterClient inviteCode={params.inviteCode} />;
}
