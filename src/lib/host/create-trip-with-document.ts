import { createTripForHost } from "@/lib/host/trip-create";

/** Creates a bare trip shell — document import runs separately for live builder preview. */
export async function createTripShell(params: {
  hostId: string;
  name: string;
  timezone?: string;
}) {
  const timezone = params.timezone?.trim() || "UTC";
  const trip = await createTripForHost({
    hostId: params.hostId,
    name: params.name.trim(),
    schoolName: "School trip",
    timezone,
    defaultCountryCallingCode: "NZ",
  });

  return trip;
}
