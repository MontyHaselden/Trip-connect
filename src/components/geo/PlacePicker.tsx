"use client";

import { useCallback } from "react";

import { codesForCountryNames } from "@/lib/geo/countries";

import { AutocompleteField, type AutocompleteOption } from "./AutocompleteField";

export function PlacePicker({
  value,
  onChange,
  onSelectOption,
  onBlur,
  placeholder = "Search city or region…",
  countryNames = [],
  inputClassName,
  useShortLabel = true,
}: {
  value: string;
  onChange: (value: string) => void;
  onSelectOption?: (value: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  countryNames?: string[];
  inputClassName?: string;
  /** Store short label (e.g. "Tokyo, Japan") when selecting from list */
  useShortLabel?: boolean;
}) {
  const search = useCallback(
    async (query: string): Promise<AutocompleteOption[]> => {
      const codes = codesForCountryNames(countryNames);
      const params = new URLSearchParams({ q: query });
      if (codes.length) params.set("countries", codes.join(","));

      const res = await fetch(`/api/geo/places?${params.toString()}`);
      if (!res.ok) return [];
      const body = await res.json();
      const suggestions = (body.suggestions ?? []) as Array<{
        id: string;
        label: string;
        shortLabel: string;
        region: string | null;
        country: string | null;
      }>;

      return suggestions.map((s) => ({
        id: s.id,
        label: useShortLabel ? s.shortLabel : s.label,
        sublabel:
          s.region && s.country
            ? `${s.region} · ${s.country}`
            : s.region ?? s.country ?? undefined,
      }));
    },
    [countryNames, useShortLabel],
  );

  return (
    <AutocompleteField
      value={value}
      onChange={onChange}
      onSelectOption={
        onSelectOption
          ? (option) => onSelectOption(option.label)
          : undefined
      }
      onBlur={onBlur}
      placeholder={placeholder}
      search={search}
      minChars={2}
      inputClassName={inputClassName}
    />
  );
}
