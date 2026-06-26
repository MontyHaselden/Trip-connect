import {
  isAddressLikeLodgingQuery,
  primaryCityFromAddressLikeQuery,
  sanitizeCityHint,
} from "@/lib/geo/accommodation-search";
import { googlePlacesConfigured } from "@/lib/geo/google-places";

import { geocodeStayCity } from "./city-geocode";
import { planLodgingQueryAttempts, plannerHints } from "./query-planner";
import { rankAndFilterLodgingResults } from "./rank-results";
import { runLodgingProviderSearch } from "./search-providers";
import type {
  LodgingSearchContext,
  LodgingSearchResponse,
  LodgingSearchResult,
} from "./types";

export type {
  LodgingMatchTier,
  LodgingSearchContext,
  LodgingSearchMeta,
  LodgingSearchResponse,
  LodgingSearchResult,
} from "./types";

export { planLodgingQueryAttempts, plannerHints } from "./query-planner";
export {
  candidateCityLabel,
  candidateMatchesStayCity,
  cityFromSecondarySublabel,
  mapToTripCityVocabulary,
  rankAndFilterLodgingResults,
} from "./rank-results";
export { clearCityGeocodeCache, geocodeStayCity } from "./city-geocode";

const DEFAULT_BIAS_RADIUS_METERS = 30_000;

export async function searchLodging(ctx: LodgingSearchContext): Promise<LodgingSearchResponse> {
  const query = ctx.query.trim();
  const stayCity = sanitizeCityHint(ctx.stayCity) ?? ctx.stayCity.trim();
  const limit = ctx.limit ?? 10;
  const googleConfigured = googlePlacesConfigured();

  if (query.length < 2) {
    return {
      suggestions: [],
      meta: { widened: false, stayCity, hints: [], googleConfigured },
    };
  }

  const queryCity = isAddressLikeLodgingQuery(query)
    ? primaryCityFromAddressLikeQuery(query)
    : undefined;
  const biasCity = queryCity ?? stayCity;
  const geocoded = biasCity ? await geocodeStayCity(biasCity, ctx.countryCodes) : null;
  const locationBias = geocoded
    ? { lat: geocoded.lat, lng: geocoded.lng, radiusMeters: DEFAULT_BIAS_RADIUS_METERS }
    : undefined;

  const attempts = planLodgingQueryAttempts(query, stayCity);
  const seen = new Set<string>();
  const collected: LodgingSearchResult[] = [];

  for (const attempt of attempts) {
    const batch = await runLodgingProviderSearch({
      query: attempt.query,
      countryCodes: ctx.countryCodes,
      cityHint: attempt.cityHint,
      lodgingOnly: ctx.lodgingOnly,
      limit,
      locationBias,
    });

    for (const row of batch) {
      const dedupe = (row.placeId ?? row.label).toLowerCase();
      if (seen.has(dedupe)) continue;
      seen.add(dedupe);
      collected.push({ ...row, debugAttempt: attempt.debugAttempt });
    }
  }

  const { results, widened } = rankAndFilterLodgingResults(
    collected,
    query,
    stayCity,
    limit,
  );

  const searchingIn =
    geocoded?.name.split(",")[0]?.trim() ?? biasCity ?? stayCity;
  const hints =
    results.length === 0
      ? [
          ...plannerHints(query, stayCity, searchingIn),
          ...(!googleConfigured
            ? ["Google Maps search is not configured — hotel lookup may not work"]
            : []),
        ]
      : undefined;

  return {
    suggestions: results,
    meta: {
      widened,
      stayCity,
      searchingIn,
      hints,
      googleConfigured,
    },
  };
}
