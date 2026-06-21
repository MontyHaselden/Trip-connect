import { clearTripCache, getMeta, putMeta, putPublishedTrip } from "./trip-store";

export type SyncResult =
  | { status: "no_session" }
  | { status: "offline_no_cache" }
  | { status: "up_to_date"; version: number; publishedAt?: string }
  | { status: "updated"; version: number; publishedAt?: string }
  | { status: "unauthorized" }
  | { status: "error"; message: string };

export async function syncPublishedTrip(params: {
  tripId: string | null;
  accessToken: string | null;
  online: boolean;
}): Promise<SyncResult> {
  const { tripId, accessToken, online } = params;
  if (!tripId || !accessToken) return { status: "no_session" };

  const cached = await getMeta(tripId);

  if (!online) {
    if (!cached) return { status: "offline_no_cache" };
    return { status: "up_to_date", version: cached.version, publishedAt: cached.publishedAt };
  }

  const base = `/api/trips/${encodeURIComponent(tripId)}/published`;
  const headers = { authorization: `Bearer ${accessToken}` };

  const head = await fetch(base, { method: "HEAD", headers });
  if (head.status === 401) return { status: "unauthorized" };
  if (!head.ok && head.status !== 204) {
    return { status: "error", message: `HEAD failed (${head.status})` };
  }

  const versionHeader = head.headers.get("X-Trip-Version");
  const publishedAtHeader = head.headers.get("X-Published-At") ?? undefined;
  const latestVersion = versionHeader ? Number(versionHeader) : NaN;

  if (!Number.isFinite(latestVersion)) {
    return { status: "error", message: "Missing X-Trip-Version" };
  }

  if (cached && cached.version === latestVersion) {
    return { status: "up_to_date", version: cached.version, publishedAt: cached.publishedAt };
  }

  if (latestVersion === 0) {
    await putMeta({
      tripId,
      version: 0,
      publishedAt: publishedAtHeader,
      cachedAt: new Date().toISOString(),
    });
    return { status: "up_to_date", version: 0, publishedAt: publishedAtHeader };
  }

  const res = await fetch(base, { method: "GET", headers });
  if (res.status === 401) return { status: "unauthorized" };
  if (!res.ok) {
    if (res.status === 404) {
      await putMeta({
        tripId,
        version: 0,
        publishedAt: publishedAtHeader,
        cachedAt: new Date().toISOString(),
      });
      return { status: "up_to_date", version: 0, publishedAt: publishedAtHeader };
    }
    return { status: "error", message: `GET failed (${res.status})` };
  }

  const payload = await res.json();
  await putPublishedTrip(tripId, payload);
  await putMeta({
    tripId,
    version: latestVersion,
    publishedAt: publishedAtHeader,
    cachedAt: new Date().toISOString(),
  });

  return { status: "updated", version: latestVersion, publishedAt: publishedAtHeader };
}

export async function clearStudentSessionAndCache() {
  const tripId = localStorage.getItem("tc_trip_id");
  localStorage.removeItem("tc_trip_id");
  localStorage.removeItem("tc_participant_id");
  localStorage.removeItem("tc_access_token");
  localStorage.removeItem("tc_invite_code");
  localStorage.removeItem("tc_joined_at");
  if (tripId) await clearTripCache(tripId);
}

