import {
  hotelNameFromCompoundQuery,
  isAddressLikeLodgingQuery,
  resolveLodgingSearchQuery,
} from "@/lib/geo/accommodation-search";

import type { QueryAttempt } from "./types";

/** Build ordered search attempts — collect from all, do not stop on first hit. */
export function planLodgingQueryAttempts(
  query: string,
  stayCity: string,
): QueryAttempt[] {
  const trimmed = query.trim();
  const resolved = resolveLodgingSearchQuery(query, stayCity);
  const attempts: QueryAttempt[] = [{ ...resolved, debugAttempt: "resolved" }];

  const compoundName = hotelNameFromCompoundQuery(trimmed);
  if (compoundName) {
    attempts.push({
      query: compoundName,
      cityHint: resolved.cityHint ?? stayCity,
      debugAttempt: "compound-name",
    });
  }

  if (isAddressLikeLodgingQuery(trimmed)) {
    attempts.push(
      { query: trimmed, cityHint: resolved.cityHint, debugAttempt: "address-full" },
      { query: trimmed, cityHint: undefined, debugAttempt: "address-no-hint" },
    );
  } else {
    attempts.push(
      { query: resolved.query, cityHint: undefined, debugAttempt: "no-city-hint" },
      { query: trimmed, cityHint: undefined, debugAttempt: "full-query" },
    );
  }

  if (/^the\s+/i.test(resolved.query)) {
    attempts.push({
      query: resolved.query.replace(/^the\s+/i, "").trim(),
      cityHint: resolved.cityHint,
      debugAttempt: "strip-the",
    });
  }

  const seen = new Set<string>();
  const out: QueryAttempt[] = [];
  for (const attempt of attempts) {
    if (attempt.query.length < 2) continue;
    const key = `${attempt.query.toLowerCase()}|${attempt.cityHint?.toLowerCase() ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(attempt);
  }
  return out;
}

/** Hints for empty-state UI when no results are found. */
export function plannerHints(
  query: string,
  stayCity: string,
  searchingIn?: string,
): string[] {
  const resolved = resolveLodgingSearchQuery(query, stayCity);
  const hints: string[] = [];

  if (isAddressLikeLodgingQuery(query) && !hotelNameFromCompoundQuery(query)) {
    hints.push("Search the hotel name (e.g. Hotel New Hankyu Kyoto), not the street address alone");
  }

  const stripped = resolved.query.replace(/^the\s+/i, "").trim();
  if (stripped.length >= 2 && stripped.toLowerCase() !== query.trim().toLowerCase()) {
    hints.push(`Try searching: ${stripped}`);
  } else if (resolved.query.length >= 2 && resolved.query !== query.trim()) {
    hints.push(`Try searching: ${resolved.query}`);
  }

  const compoundName = hotelNameFromCompoundQuery(query);
  if (compoundName && compoundName.toLowerCase() !== query.trim().toLowerCase()) {
    hints.push(`Try searching: ${compoundName}`);
  }

  if (searchingIn) {
    hints.push(`Searching in: ${searchingIn}`);
  } else if (stayCity.trim()) {
    hints.push(`Searching in: ${stayCity.trim()}`);
  }

  return hints;
}
