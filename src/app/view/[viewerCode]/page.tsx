import { ViewerTripClient } from "@/components/viewer/ViewerTripClient";

export default async function ViewerPage({
  params,
}: {
  params: Promise<{ viewerCode: string }>;
}) {
  const { viewerCode } = await params;
  return (
    <main className="min-h-dvh bg-zinc-50">
      <ViewerTripClient viewerCode={viewerCode} />
    </main>
  );
}
