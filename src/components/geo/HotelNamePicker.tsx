"use client";

import { useCallback, useRef } from "react";

import { codesForCountryNames } from "@/lib/geo/countries";

import { AutocompleteField, type AutocompleteOption } from "./AutocompleteField";

export type HotelSelection = {
  name: string;
  address: string;
};

type HotelSuggestionResponse = {
  id: string;
  label: string;
  sublabel?: string;
  address?: string;
  name?: string;
  placeId?: string;
  source: "google" | "nominatim";
};

export function HotelNamePicker({
  value,
  onChange,
  onSelectHotel,
  onBlur,
  placeholder = "Search hotel on Google Maps…",
  countryNames = [],
  cityHint,
  inputClassName,
}: {
  value: string;
  onChange: (value: string) => void;
  onSelectHotel: (selection: HotelSelection) => void;
  onBlur?: () => void;
  placeholder?: string;
  countryNames?: string[];
  cityHint?: string;
  inputClassName?: string;
}) {
  const suggestionMeta = useRef(new Map<string, HotelSuggestionResponse>());

  const search = useCallback(
    async (query: string): Promise<AutocompleteOption[]> => {
      const codes = codesForCountryNames(countryNames);
      const params = new URLSearchParams({ q: query, lodging: "1" });
      if (codes.length) params.set("countries", codes.join(","));
      if (cityHint?.trim()) params.set("city", cityHint.trim());

      const res = await fetch(`/api/geo/addresses?${params.toString()}`);
      if (!res.ok) return [];
      const body = await res.json();
      const suggestions = (body.suggestions ?? []) as HotelSuggestionResponse[];

      suggestionMeta.current = new Map(suggestions.map((s) => [s.id, s]));

      return suggestions.map((s) => ({
        id: s.id,
        label: s.label,
        sublabel: s.sublabel,
      }));
    },
    [cityHint, countryNames],
  );

  const handleSelect = useCallback(
    async (option: AutocompleteOption) => {
      const meta = suggestionMeta.current.get(option.id);
      let name = meta?.name ?? meta?.label ?? option.label;
      let address = meta?.address ?? "";

      if (meta?.placeId) {
        const res = await fetch(
          `/api/geo/addresses?placeId=${encodeURIComponent(meta.placeId)}`,
        );
        if (res.ok) {
          const details = (await res.json()) as { address: string; name: string | null };
          address = details.address;
          name = details.name ?? name;
        } else if (meta.sublabel) {
          address = [meta.label, meta.sublabel].filter(Boolean).join(", ");
        }
      } else if (!address && meta?.sublabel) {
        address = [meta.label, meta.sublabel].filter(Boolean).join(", ");
      }

      onChange(name);
      if (address) {
        onSelectHotel({ name, address });
      }
    },
    [onChange, onSelectHotel],
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
    />
  );
}
