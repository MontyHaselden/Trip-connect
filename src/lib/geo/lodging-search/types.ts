import type { AddressSuggestion } from "@/lib/geo/google-places";

export type LodgingMatchTier = "exact" | "metro" | "wide";

export type LodgingSearchContext = {
  query: string;
  stayCity: string;
  countryCodes?: string[];
  lodgingOnly?: boolean;
  limit?: number;
};

export type LodgingSearchResult = AddressSuggestion & {
  matchTier?: LodgingMatchTier;
  debugAttempt?: string;
};

export type LodgingSearchMeta = {
  widened: boolean;
  stayCity: string;
  hints?: string[];
  searchingIn?: string;
};

export type LodgingSearchResponse = {
  suggestions: LodgingSearchResult[];
  meta: LodgingSearchMeta;
};

export type QueryAttempt = {
  query: string;
  cityHint?: string;
  debugAttempt: string;
};
