"use client";

import { useCallback, useRef } from "react";

import {
  accommodationSearchMode,
  sanitizeCityHint,
} from "@/lib/geo/accommodation-search";
import { codesForCountryNames } from "@/lib/geo/countries";
import type { StayType } from "@/lib/host/wizard/types";

import { AutocompleteField, type AutocompleteOption } from "./AutocompleteField";

export type HotelSelection = {
  name: string;
  address: string;
  cityLabel?: string | null;
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
  placeholder,
  countryNames = [],
  cityHint,
  stayType,
  inputClassName,
}: {
  value: string;
  onChange: (value: string) => void;
  onSelectHotel: (selection: HotelSelection) => void;
  onBlur?: () => void;
  placeholder?: string;
  countryNames?: string[];
  cityHint?: string;
  stayType?: StayType;
  inputClassName?: string;
}) {
  const suggestionMeta = useRef(new Map<string, HotelSuggestionResponse>());
  const searchMode = accommodationSearchMode(stayType);
  const effectiveCity = sanitizeCityHint(cityHint);

  const search = useCallback(
    async (query: string): Promise<AutocompleteOption[]> => {
      const trimmed = query.trim();
      if (trimmed.length < 2) return [];

      const searchQuery = searchMode.querySuffix
        ? `${trimmed} ${searchMode.querySuffix}`
        : trimmed;

      const codes = codesForCountryNames(countryNames);
      const params = new URLSearchParams({ q: searchQuery });
      if (searchMode.lodgingOnly) params.set("lodging", "1");
      if (codes.length) params.set("countries", codes.join(","));
      if (effectiveCity) params.set("city", effectiveCity);

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
    [countryNames, effectiveCity, searchMode.lodgingOnly, searchMode.querySuffix],
  );

  const handleSelect = useCallback(
    async (option: AutocompleteOption) => {
      const meta = suggestionMeta.current.get(option.id);
      let name = meta?.name ?? meta?.label ?? option.label;
      let address = meta?.address ?? "";

      let cityLabel: string | null | undefined;

      if (meta?.placeId) {
        const res = await fetch(
          `/api/geo/addresses?placeId=${encodeURIComponent(meta.placeId)}`,
        );
        if (res.ok) {
          const details = (await res.json()) as {
            address: string;
            name: string | null;
            cityLabel?: string | null;
          };
          address = details.address;
          name = details.name ?? name;
          cityLabel = details.cityLabel;
        } else if (meta.sublabel) {
          address = [meta.label, meta.sublabel].filter(Boolean).join(", ");
        }
      } else if (!address && meta?.sublabel) {
        address = [meta.label, meta.sublabel].filter(Boolean).join(", ");
      }

      onChange(name);
      if (address) {
        onSelectHotel({ name, address, cityLabel });
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
      placeholder={placeholder ?? searchMode.placeholder}
      search={search}
      minChars={2}
      inputClassName={inputClassName}
      emptyMessage="No matches — try another spelling"
    />
  );
}
