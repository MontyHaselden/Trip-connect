import type { TransportProductKind } from "@/lib/host/wizard/types";

export type TransportProductSuggestion = {
  kind: TransportProductKind;
  name: string;
};

const JAPAN_SUGGESTIONS: TransportProductSuggestion[] = [
  { kind: "train_pass", name: "JR Pass" },
  { kind: "ic_card", name: "Suica" },
  { kind: "ic_card", name: "Pasmo" },
  { kind: "bus_pass", name: "Highway bus pass" },
];

function isJapanTrip(basics: {
  destinationCountries?: string[];
  timezone?: string;
}): boolean {
  const countries = basics.destinationCountries ?? [];
  if (
    countries.some((c) => /japan/i.test(c.trim())) ||
    countries.some((c) => c.trim().toLowerCase() === "jp")
  ) {
    return true;
  }
  return basics.timezone === "Asia/Tokyo";
}

export function transportProductSuggestionsForTrip(basics: {
  destinationCountries?: string[];
  timezone?: string;
}): TransportProductSuggestion[] {
  if (!isJapanTrip(basics)) return [];
  return JAPAN_SUGGESTIONS;
}

export function transportProductKindLabel(kind: TransportProductKind): string {
  switch (kind) {
    case "flight_package":
      return "Flight package";
    case "train_pass":
      return "Train pass";
    case "ic_card":
      return "IC card";
    case "bus_pass":
      return "Bus pass";
    default:
      return "Transport product";
  }
}

function passKindForTravelMode(mode: "train" | "bus" | "metro"): TransportProductKind {
  if (mode === "metro") return "ic_card";
  if (mode === "bus") return "bus_pass";
  return "train_pass";
}

/** Prefer an existing pass/card that matches the travel mode; otherwise the first pass. */
export function defaultPassProductIdForMode(
  mode: "train" | "bus" | "metro",
  products: ReadonlyArray<{ id: string; kind: TransportProductKind }>,
): "new" | string {
  if (!products.length) return "new";
  const preferredKind = passKindForTravelMode(mode);
  const match = products.find((product) => product.kind === preferredKind);
  return match?.id ?? products[0]!.id;
}
