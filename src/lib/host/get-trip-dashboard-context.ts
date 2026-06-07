import { getTripByIdForHost } from "@/lib/host/get-trip-by-id";
import { loadItineraryBuildStats } from "@/lib/host/trip-delete-eligibility";
import { getTripLifecycleForTrip } from "@/lib/host/trip-lifecycle";

export async function getTripDashboardContext(hostId: string, tripId: string) {
  const trip = await getTripByIdForHost(hostId, tripId);
  if (!trip) return null;

  const stats = await loadItineraryBuildStats(trip.id);
  const lifecycle = await getTripLifecycleForTrip(
    {
      id: trip.id,
      setupMethod: trip.setupMethod,
      startDate: trip.startDate,
      endDate: trip.endDate,
      timezone: trip.timezone,
    },
    stats,
  );

  return { trip, lifecycle };
}
