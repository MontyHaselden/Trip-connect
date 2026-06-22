import { placesShareMetro } from "@/lib/geo/airport-codes";
import { locationsMatch } from "@/lib/host/wizard/location-stays";
import type { TransitOverlay } from "@/lib/host/wizard/transport-day-placement";

export function transitOverlayDestination(label: string): string | null {
  const match = /^(?:Depart for|Arrive in|Fly to)\s+(.+)$/i.exec(label.trim());
  return match?.[1]?.trim() ?? null;
}

export function destinationCoveredByOverlays(
  city: string,
  overlays: TransitOverlay[],
): boolean {
  const trimmed = city.trim();
  if (!trimmed) return false;

  for (const overlay of overlays) {
    const dest = transitOverlayDestination(overlay.label);
    if (!dest) continue;
    if (locationsMatch(trimmed, dest) || placesShareMetro(trimmed, dest)) {
      return true;
    }
  }

  return false;
}
