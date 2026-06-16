import { mainAccommodationStays, mainIntercityLegs } from "./entity-scope";
import type { TripSetupState } from "./types";
import type { PropagateScope } from "@/lib/groups/propagate-change";

export async function propagateMainEntitiesAfterSave(
  tripId: string,
  state: TripSetupState,
  scope: PropagateScope,
): Promise<void> {
  if (scope === "main_only") return;

  const selectedGroupIds = state.groups.filter((g) => !g.isMain).map((g) => g.id);

  for (const stay of mainAccommodationStays(state)) {
    const hasLinked = state.accommodationStays.some((s) => s.sourceEntityId === stay.id);
    if (!hasLinked) continue;
    await fetch(`/api/trips/${tripId}/entities/${stay.id}/propagate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        entityType: "accommodation_stay",
        scope,
        selectedGroupIds: scope === "selected_groups" ? selectedGroupIds : undefined,
        patch: {
          cityLabel: stay.cityLabel,
          stayType: stay.stayType,
          name: stay.name,
          url: stay.url,
          address: stay.address,
          phone: stay.phone,
          notes: stay.notes,
        },
      }),
    });
  }

  for (const leg of mainIntercityLegs(state)) {
    const hasLinked = state.intercityLegs.some((l) => l.sourceEntityId === leg.id);
    if (!hasLinked) continue;
    await fetch(`/api/trips/${tripId}/entities/${leg.id}/propagate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        entityType: "transport_leg",
        scope,
        selectedGroupIds: scope === "selected_groups" ? selectedGroupIds : undefined,
        patch: {
          transportType: leg.transportType,
          bookingStatus: leg.bookingStatus,
          fromCity: leg.fromCity,
          toCity: leg.toCity,
          fromStation: leg.fromStation,
          toStation: leg.toStation,
          operator: leg.operator,
          referenceNumber: leg.referenceNumber,
          flightNumber: leg.flightNumber,
          notes: leg.notes,
        },
      }),
    });
  }
}
