import { inferCityLabelFromAddress } from "@/lib/geo/accommodation-search";
import { placesShareMetro } from "@/lib/geo/airport-codes";
import type { AddressSuggestion } from "@/lib/geo/google-places";
import { metroDisplayLabel } from "@/lib/host/setup/metro-display";
import { locationsMatch } from "@/lib/host/wizard/location-stays";

import type { LodgingMatchTier, LodgingSearchResult } from "./types";

const STOP_WORDS = /^(the|a|an|hotel|hotels|inn|hostel|resort)$/i;

const COUNTRY_LABELS = new Set([
  "japan",
  "thailand",
  "australia",
  "new zealand",
  "united states",
  "united kingdom",
  "singapore",
  "indonesia",
  "vietnam",
  "cambodia",
  "malaysia",
  "france",
  "italy",
  "spain",
  "germany",
  "china",
  "south korea",
  "korea",
  "taiwan",
  "philippines",
]);

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

/** Google secondary text is often "Country, City, Ward, …" — not "City, Region". */
export function cityFromSecondarySublabel(sublabel: string): string | null {
  const parts = sublabel
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (!parts.length) return null;

  let working = [...parts];
  const lastLower = working[working.length - 1]?.toLowerCase() ?? "";
  if (COUNTRY_LABELS.has(lastLower)) {
    working = working.slice(0, -1);
  }

  const firstLower = working[0]?.toLowerCase() ?? "";
  if (COUNTRY_LABELS.has(firstLower) && working.length >= 2) {
    return working[1]!;
  }

  for (let i = 0; i < working.length; i++) {
    const part = working[i]!;
    if (/^(ward|district|prefecture|city|county|province)$/i.test(part) && i > 0) {
      return working[i - 1]!;
    }
    if (/\b(ward|district|prefecture)\b/i.test(part) && i > 0) {
      return working[i - 1]!;
    }
  }

  const first = working[0] ?? "";
  if (first && !/^\d/.test(first) && !looksLikeStreetPart(first)) {
    return first;
  }

  return working.find((part) => !looksLikeStreetPart(part) && !/^\d/.test(part)) ?? null;
}

function looksLikeStreetPart(part: string): boolean {
  return /^\d/.test(part) || /(chome|chōme|street|road|rd|ave|avenue|soi)/i.test(part);
}

export function candidateCityLabel(candidate: AddressSuggestion): string {
  if (candidate.sublabel?.trim()) {
    const fromSecondary = cityFromSecondarySublabel(candidate.sublabel);
    if (fromSecondary) return fromSecondary;
  }
  if (candidate.address?.trim()) {
    const fromAddress = inferCityLabelFromAddress(candidate.address);
    if (fromAddress) return fromAddress.split(",")[0]?.trim() ?? fromAddress;

    const parts = candidate.address.split(",").map((p) => p.trim()).filter(Boolean);
    for (const part of parts) {
      if (/prefecture$/i.test(part)) {
        const city = part.replace(/\s*prefecture$/i, "").trim();
        if (city) return city;
      }
    }
  }
  return "";
}

function labelMentionsStayCity(label: string, stayCity: string): boolean {
  const stayToken = stayCity.split(",")[0]?.trim().toLowerCase() ?? "";
  if (!stayToken || stayToken.length < 3) return false;
  return normalize(label).includes(normalize(stayToken));
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
  if (labelMentionsStayCity(candidate.label, stay)) return "exact";
  if (candidate.address && labelMentionsStayCity(candidate.address, stay)) return "exact";
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
