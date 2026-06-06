import { redirectHostManageToDashboard } from "@/lib/host/redirect-to-dashboard";

export default async function LegacyHostPublishPage({
  params,
}: {
  params: Promise<{ inviteCode: string }>;
}) {
  const { inviteCode } = await params;
  await redirectHostManageToDashboard(inviteCode, "builder");
}
