import { PhrasesClient } from "@/components/host/phrases/PhrasesClient";

export default function HostPhrasesPage({
  params,
}: {
  params: { inviteCode: string };
}) {
  return <PhrasesClient inviteCode={params.inviteCode} />;
}
