export type AddressSuggestion = {
  id: string;
  label: string;
  sublabel?: string;
  address?: string;
  name?: string;
  placeId?: string;
  source: "google" | "nominatim";
};

function apiKey(): string | undefined {
  return process.env.GOOGLE_MAPS_API_KEY?.trim() || undefined;
}

export function googlePlacesConfigured(): boolean {
  return Boolean(apiKey());
}

type GoogleAutocompleteResponse = {
  suggestions?: Array<{
    placePrediction?: {
      placeId?: string;
      place?: string;
      text?: { text?: string };
      structuredFormat?: {
        mainText?: { text?: string };
        secondaryText?: { text?: string };
      };
    };
  }>;
};

function placeIdFromPrediction(prediction: NonNullable<
  GoogleAutocompleteResponse["suggestions"]
>[number]["placePrediction"]): string | undefined {
  if (prediction?.placeId) return prediction.placeId;
  const resource = prediction?.place;
  if (resource?.startsWith("places/")) return resource.slice("places/".length);
  return undefined;
}

export async function searchGoogleAddresses(params: {
  query: string;
  countryCodes?: string[];
  cityHint?: string;
  limit?: number;
  lodgingOnly?: boolean;
}): Promise<AddressSuggestion[]> {
  const key = apiKey();
  const q = params.query.trim();
  if (!key || q.length < 2) return [];

  const input = params.cityHint
    ? `${q}, ${params.cityHint.split(",")[0]?.trim() ?? params.cityHint}`
    : q;

  const body: Record<string, unknown> = {
    input,
    languageCode: "en",
  };
  if (params.lodgingOnly) {
    body.includedPrimaryTypes = ["lodging"];
  }
  if (params.countryCodes?.length) {
    body.includedRegionCodes = params.countryCodes.map((c) => c.toUpperCase());
  }

  try {
    const res = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask":
          "suggestions.placePrediction.placeId,suggestions.placePrediction.place,suggestions.placePrediction.structuredFormat,suggestions.placePrediction.text",
      },
      body: JSON.stringify(body),
      next: { revalidate: 3600 },
    });

    if (!res.ok) return [];

    const data = (await res.json()) as GoogleAutocompleteResponse;
    const out: AddressSuggestion[] = [];
    const seen = new Set<string>();

    for (const row of data.suggestions ?? []) {
      const prediction = row.placePrediction;
      if (!prediction) continue;

      const placeId = placeIdFromPrediction(prediction);
      const name = prediction.structuredFormat?.mainText?.text?.trim();
      const area = prediction.structuredFormat?.secondaryText?.text?.trim();
      const label = name || prediction.text?.text?.trim();
      if (!label) continue;

      const keyLabel = label.toLowerCase();
      if (seen.has(keyLabel)) continue;
      seen.add(keyLabel);

      out.push({
        id: placeId ?? `google-${keyLabel}`,
        label,
        sublabel: area,
        name,
        placeId,
        source: "google",
      });
    }

    return out.slice(0, params.limit ?? 10);
  } catch {
    return [];
  }
}

export async function getGooglePlaceDetails(
  placeId: string,
): Promise<{ address: string; name: string | null } | null> {
  const key = apiKey();
  if (!key || !placeId.trim()) return null;

  try {
    const res = await fetch(
      `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`,
      {
        headers: {
          "X-Goog-Api-Key": key,
          "X-Goog-FieldMask": "formattedAddress,displayName",
        },
        next: { revalidate: 86400 },
      },
    );

    if (!res.ok) return null;

    const data = (await res.json()) as {
      formattedAddress?: string;
      displayName?: { text?: string };
    };

    const address = data.formattedAddress?.trim();
    if (!address) return null;

    return {
      address,
      name: data.displayName?.text?.trim() ?? null,
    };
  } catch {
    return null;
  }
}
