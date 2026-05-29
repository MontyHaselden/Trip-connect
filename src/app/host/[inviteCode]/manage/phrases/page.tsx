import { PhrasesClient } from "@/components/host/phrases/PhrasesClient";

export default async function HostPhrasesPage({
  params,
}: {
  params: Promise<{ inviteCode: string }>;
}) {
  const { inviteCode } = await params;
  return <PhrasesClient inviteCode={inviteCode} />;
}
