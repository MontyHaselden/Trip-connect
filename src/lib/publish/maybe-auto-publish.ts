import { publishTrip } from "@/lib/publish/publish-trip";
import { tripNeedsPublishConfirm } from "@/lib/publish/trip-live";

export async function maybeAutoPublish(tripId: string) {
  const needsConfirm = await tripNeedsPublishConfirm(tripId);
  if (needsConfirm) return null;
  return publishTrip(tripId);
}
