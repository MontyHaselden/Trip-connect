import { cityChangePaintDate } from "@/lib/host/setup/derive-calendar";
import { locationsMatch } from "@/lib/host/wizard/location-stays";
import type { AccommodationStayDraft, DayPlaceDraft, IntercityLegDraft } from "@/lib/host/wizard/types";

function routeKey(leg: IntercityLegDraft): string {
  return `${leg.intercityFromCity.trim().toLowerCase()}→${leg.intercityToCity.trim().toLowerCase()}`;
}

/** Drop duplicate Patong→Bangkok legs; keep the one on the stay crossover date. */
export function dedupeCityChangeLegs(
  legs: IntercityLegDraft[],
  stays: AccommodationStayDraft[],
  dayPlaces: DayPlaceDraft[],
): IntercityLegDraft[] {
  const named = stays.filter((s) => s.name?.trim());
  const keptRoutes = new Map<string, IntercityLegDraft>();
  const other: IntercityLegDraft[] = [];

  for (const leg of legs) {
    const isCityChange = leg.legKind === "city_change" || !leg.legKind;
    if (!isCityChange) {
      other.push(leg);
      continue;
    }

    const key = routeKey(leg);
    const canonicalDate = cityChangePaintDate(leg, named, dayPlaces);
    const existing = keptRoutes.get(key);

    if (!existing) {
      keptRoutes.set(key, {
        ...leg,
        travelDate: canonicalDate ?? leg.travelDate,
      });
      continue;
    }

    const existingCanonical = cityChangePaintDate(existing, named, dayPlaces);
    const legMatches =
      canonicalDate && leg.travelDate === canonicalDate;
    const existingMatches =
      existingCanonical && existing.travelDate === existingCanonical;

    if (legMatches && !existingMatches) {
      keptRoutes.set(key, { ...leg, travelDate: canonicalDate! });
    } else if (
      !existingMatches &&
      canonicalDate &&
      locationsMatch(leg.intercityFromCity, existing.intercityFromCity) &&
      locationsMatch(leg.intercityToCity, existing.intercityToCity)
    ) {
      keptRoutes.set(key, {
        ...existing,
        travelDate: canonicalDate,
        fromCity: leg.fromCity || existing.fromCity,
        toCity: leg.toCity || existing.toCity,
      });
    }
  }

  return [...other, ...keptRoutes.values()];
}
