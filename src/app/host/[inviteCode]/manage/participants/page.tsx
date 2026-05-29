import { RosterClient } from "@/components/host/roster/RosterClient";

export default async function HostParticipantsPage({
  params,
}: {
  params: Promise<{ inviteCode: string }>;
}) {
  const { inviteCode } = await params;
  return <RosterClient inviteCode={inviteCode} />;
}
