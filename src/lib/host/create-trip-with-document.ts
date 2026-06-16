import { tripHomeDefaultsFromAccount } from "@/lib/host/account-home";
import { getHostAccountById } from "@/lib/host/auth";
import { createTripForHost } from "@/lib/host/trip-create";

/** Creates a bare trip shell — Trip OS loads setup state from the trip graph, not wizard drafts. */
export async function createTripShell(params: {
  hostId: string;
  name: string;
  timezone?: string;
}) {
  const timezone = params.timezone?.trim() || "UTC";
  const host = await getHostAccountById(params.hostId);
  const homeDefaults = host
    ? tripHomeDefaultsFromAccount({
        homeCity: host.homeCity ?? "",
        defaultAirport: host.defaultAirport ?? "",
        schoolName: host.schoolName,
      })
    : null;

  return createTripForHost({
    hostId: params.hostId,
    name: params.name.trim(),
    schoolName: homeDefaults?.schoolName ?? "School trip",
    timezone,
    defaultCountryCallingCode: "NZ",
    setupMethod: "ai",
    departureCity: homeDefaults?.departureCity,
    returnCity: homeDefaults?.returnCity,
    defaultDepartureAirport: homeDefaults?.defaultDepartureAirport,
  });
}
