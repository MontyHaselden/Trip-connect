"use client";

import { useCallback, useRef } from "react";

import { codesForCountryNames } from "@/lib/geo/countries";

import { AutocompleteField, type AutocompleteOption } from "./AutocompleteField";

export type VenueSelection = {
  name: string;
  address: string;
  placeId?: string | null;
  lat?: number | null;
  lng?: number | null;
};

type VenueSuggestionResponse = {
  id: string;
  label: string;
  sublabel?: string;
  address?: string;
  name?: string;
  placeId?: string;
  source: "google" | "nominatim";
};

export function VenueNamePicker({
  value,
  onChange,
  onSelectVenue,
  onBlur,
  placeholder = "Search venue on Google Maps…",
  countryNames = [],
  cityHint,
  inputClassName,
}: {
  value: string;
  onChange: (value: string) => void;
  onSelectVenue: (selection: VenueSelection) => void;
  onBlur?: () => void;
  placeholder?: string;
  countryNames?: string[];
  /** @deprecated Ignored — venue search is trip-wide within destination countries. */
  cityHint?: string;
  inputClassName?: string;
}) {
  const suggestionMeta = useRef(new Map<string, VenueSuggestionResponse>());

  const search = useCallback(
    async (query: string): Promise<AutocompleteOption[]> => {
      const codes = codesForCountryNames(countryNames);
      const params = new URLSearchParams({ q: query, wide: "1" });
      if (codes.length) params.set("countries", codes.join(","));

      const res = await fetch(`/api/geo/addresses?${params.toString()}`);
      if (!res.ok) return [];
      const body = await res.json();
      const suggestions = (body.suggestions ?? []) as VenueSuggestionResponse[];

      suggestionMeta.current = new Map(suggestions.map((s) => [s.id, s]));

      return suggestions.map((s) => ({
        id: s.id,
        label: s.label,
        sublabel: s.sublabel,
      }));
    },
    [countryNames],
  );

  const handleSelect = useCallback(
    async (option: AutocompleteOption) => {
      const meta = suggestionMeta.current.get(option.id);
      let name = meta?.name ?? meta?.label ?? option.label;
      let address = meta?.address ?? "";
      let placeId: string | null = meta?.placeId ?? null;
      let lat: number | null = null;
      let lng: number | null = null;

      if (meta?.placeId) {
        const res = await fetch(
          `/api/geo/addresses?placeId=${encodeURIComponent(meta.placeId)}`,
        );
        if (res.ok) {
          const details = (await res.json()) as {
            address: string;
            name: string | null;
            lat?: number | null;
            lng?: number | null;
          };
          address = details.address;
          name = details.name ?? name;
          placeId = meta.placeId;
          lat = details.lat ?? null;
          lng = details.lng ?? null;
        } else if (meta.sublabel) {
          address = [meta.label, meta.sublabel].filter(Boolean).join(", ");
        }
      } else if (!address && meta?.sublabel) {
        address = [meta.label, meta.sublabel].filter(Boolean).join(", ");
      }

      onChange(name);
      if (address) {
        onSelectVenue({ name, address, placeId, lat, lng });
      }
    },
    [onChange, onSelectVenue],
  );

  return (
    <AutocompleteField
      value={value}
      onChange={onChange}
      onSelectOption={(option) => {
        void handleSelect(option);
      }}
      onBlur={onBlur}
      placeholder={placeholder}
      search={search}
      minChars={2}
      inputClassName={inputClassName}
      emptyMessage="No matches — try the venue name and city (e.g. teamLab Osaka)"
    />
  );
}
