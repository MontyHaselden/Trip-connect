"use client";

import { useCallback, useRef, useState } from "react";

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
  placeId?: string | null;
  lat?: number | null;
  lng?: number | null;
};

type HotelSuggestionResponse = {
  id: string;
  label: string;
  sublabel?: string;
  address?: string;
  name?: string;
  placeId?: string;
  source: "google" | "nominatim";
  matchTier?: "exact" | "metro" | "wide";
};

type SearchMeta = {
  widened?: boolean;
  stayCity?: string;
  hints?: string[];
  searchingIn?: string;
};

export function HotelNamePicker({
  value,
  onChange,
  onSelectHotel,
  onBlur,
  placeholder,
  countryNames = [],
  cityHint,
  stayCity,
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
  stayCity?: string;
  stayType?: StayType;
  inputClassName?: string;
}) {
  const suggestionMeta = useRef(new Map<string, HotelSuggestionResponse>());
  const searchMode = accommodationSearchMode(stayType);
  const effectiveStayCity = sanitizeCityHint(stayCity ?? cityHint);
  const [emptyHint, setEmptyHint] = useState<string | undefined>();
  const [widenedNotice, setWidenedNotice] = useState<string | undefined>();

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
      if (effectiveStayCity) params.set("stayCity", effectiveStayCity);

      const res = await fetch(`/api/geo/addresses?${params.toString()}`);
      if (!res.ok) return [];
      const body = await res.json();
      const suggestions = (body.suggestions ?? []) as HotelSuggestionResponse[];
      const meta = (body.meta ?? {}) as SearchMeta;

      suggestionMeta.current = new Map(suggestions.map((s) => [s.id, s]));

      if (meta.widened && effectiveStayCity) {
        setWidenedNotice(`Nothing in ${effectiveStayCity} — showing wider results`);
      } else {
        setWidenedNotice(undefined);
      }

      if (suggestions.length === 0 && meta.hints?.length) {
        setEmptyHint(meta.hints.join(" · "));
      } else {
        setEmptyHint(undefined);
      }

      return suggestions.map((s) => ({
        id: s.id,
        label: s.label,
        sublabel: s.matchTier === "wide" ? `${s.sublabel ?? ""} (outside stay city)`.trim() : s.sublabel,
      }));
    },
    [countryNames, effectiveStayCity, searchMode.lodgingOnly, searchMode.querySuffix],
  );

  const handleSelect = useCallback(
    async (option: AutocompleteOption) => {
      const meta = suggestionMeta.current.get(option.id);
      let name = meta?.name ?? meta?.label ?? option.label;
      let address = meta?.address ?? "";
      let placeId: string | null = meta?.placeId ?? null;
      let lat: number | null = null;
      let lng: number | null = null;

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
            lat?: number | null;
            lng?: number | null;
          };
          address = details.address;
          name = details.name ?? name;
          cityLabel = details.cityLabel;
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
        onSelectHotel({ name, address, cityLabel, placeId, lat, lng });
      }
    },
    [onChange, onSelectHotel],
  );

  return (
    <div className="space-y-1">
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
        emptyHint={emptyHint}
      />
      {widenedNotice ? (
        <p className="text-xs text-amber-700">{widenedNotice}</p>
      ) : null}
    </div>
  );
}
