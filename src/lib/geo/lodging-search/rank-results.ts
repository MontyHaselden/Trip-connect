import { inferCityLabelFromAddress } from "@/lib/geo/accommodation-search";
import { placesShareMetro } from "@/lib/geo/airport-codes";
import type { AddressSuggestion } from "@/lib/geo/google-places";
import { metroDisplayLabel } from "@/lib/host/setup/metro-display";
import { locationsMatch } from "@/lib/host/wizard/location-stays";

import type { LodgingMatchTier, LodgingSearchResult } from "./types";

const STOP_WORDS = /^(the|a|an|hotel|hotels|inn|hostel|resort)$/i;

function normalize(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function nameSimilarity(query: string, label: string): number {
  const q = normalize(query);
  const l = normalize(label);
  if (!q || !l) return 0;
  if (l.includes(q) || q.includes(l)) return 1;

  const qTokens = q.split(" ").filter((t) => t.length > 1 && !STOP_WORDS.test(t));
  if (!qTokens.length) return 0;

  const lTokens = l.split(" ");
  const matched = qTokens.filter((token) =>
    lTokens.some((lt) => lt === token || lt.includes(token) || token.includes(lt)),
  );
  return matched.length / qTokens.length;
}

export function candidateCityLabel(candidate: AddressSuggestion): string {
  if (candidate.sublabel?.trim()) {
    const first = candidate.sublabel.split(",")[0]?.trim();
    if (first) return first;
  }
  if (candidate.address?.trim()) {
    const fromAddress = inferCityLabelFromAddress(candidate.address);
    if (fromAddress) return fromAddress.split(",")[0]?.trim() ?? fromAddress;
  }
  return "";
}

export function candidateMatchesStayCity(
  candidate: AddressSuggestion,
  stayCity: string,
): LodgingMatchTier | null {
  const resolved = candidateCityLabel(candidate);
  const stay = stayCity.trim();
  if (!resolved || !stay) return null;

  if (locationsMatch(resolved, stay)) return "exact";
  if (placesShareMetro(resolved, stay)) return "metro";
  return null;
}

function brandMatchBonus(query: string, label: string): number {
  const q = normalize(query);
  const l = normalize(label);
  if (!q || !l) return 0;
  if (l === q) return 50;
  if (l.startsWith(`${q} `) || l.startsWith(q)) return 40;
  return 0;
}

function scoreCandidate(
  candidate: AddressSuggestion,
  query: string,
  stayCity: string,
): number {
  const nameScore = nameSimilarity(query, candidate.label) * 100;
  const brandScore = brandMatchBonus(query, candidate.label);
  const tier = candidateMatchesStayCity(candidate, stayCity);
  const cityScore = tier === "exact" ? 80 : tier === "metro" ? 60 : 0;
  const addressCity = candidate.address
    ? inferCityLabelFromAddress(candidate.address)?.split(",")[0]?.trim() ?? ""
    : "";
  const addressScore =
    addressCity && locationsMatch(addressCity, stayCity) ? 20 : 0;
  const placeIdBonus = candidate.placeId ? 5 : candidate.source === "google" ? 2 : 0;
  return nameScore + brandScore + cityScore + addressScore + placeIdBonus;
}

/** Prefer trip calendar vocabulary when Maps resolves to the same metro. */
export function mapToTripCityVocabulary(mapsCity: string, stayCity: string): string {
  const maps = mapsCity.trim();
  const stay = stayCity.trim();
  if (!maps) return stay;
  if (!stay) return metroDisplayLabel(maps);
  if (locationsMatch(maps, stay) || placesShareMetro(maps, stay)) return stay;
  return metroDisplayLabel(maps);
}

export function rankAndFilterLodgingResults(
  candidates: LodgingSearchResult[],
  query: string,
  stayCity: string,
  limit = 10,
): { results: LodgingSearchResult[]; widened: boolean } {
  const stay = stayCity.trim();
  const scored = candidates
    .map((candidate) => ({
      candidate,
      score: scoreCandidate(candidate, query, stay),
      tier: candidateMatchesStayCity(candidate, stay),
    }))
    .sort((a, b) => b.score - a.score);

  const inStayCity = scored.filter((row) => row.tier !== null);
  const useWidened = inStayCity.length === 0 && scored.length > 0;
  const pool = useWidened ? scored : inStayCity;

  const seen = new Set<string>();
  const results: LodgingSearchResult[] = [];

  for (const row of pool) {
    const dedupeKey = (row.candidate.placeId ?? row.candidate.label).toLowerCase();
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    results.push({
      ...row.candidate,
      matchTier: useWidened ? "wide" : row.tier ?? "exact",
    });
    if (results.length >= limit) break;
  }

  return { results, widened: useWidened };
}
