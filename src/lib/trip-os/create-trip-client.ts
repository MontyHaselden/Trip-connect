/** Create a trip shell via POST — never use a GET route (Next.js prefetches links). */
export async function createTripShellClient(name = "New trip"): Promise<{
  ok: true;
  tripId: string;
  inviteCode: string;
} | {
  ok: false;
  error: string;
}> {
  const res = await fetch("/api/host/trips", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name }),
  });
  const body = (await res.json().catch(() => ({}))) as {
    tripId?: string;
    inviteCode?: string;
    error?: string;
  };
  if (!res.ok || !body.tripId) {
    return { ok: false, error: body.error ?? "Failed to create trip" };
  }
  return { ok: true, tripId: body.tripId, inviteCode: body.inviteCode ?? "" };
}
