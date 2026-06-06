import { redirectHostManageToDashboard } from "@/lib/host/redirect-to-dashboard";

export default async function LegacyHostPhrasesPage({
  params,
}: {
  params: Promise<{ inviteCode: string }>;
}) {
  const { inviteCode } = await params;
  await redirectHostManageToDashboard(inviteCode, "builder");
}
