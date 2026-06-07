"use client";

import { useCallback } from "react";

import { codesForCountryNames } from "@/lib/geo/countries";

import { AutocompleteField, type AutocompleteOption } from "./AutocompleteField";

export function AirportPicker({
  value,
  onChange,
  onSelectOption,
  onBlur,
  placeholder = "Search airport…",
  countryNames = [],
  inputClassName,
}: {
  value: string;
  onChange: (value: string) => void;
  onSelectOption?: (value: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  countryNames?: string[];
  inputClassName?: string;
}) {
  const search = useCallback(
    async (query: string): Promise<AutocompleteOption[]> => {
      const codes = codesForCountryNames(countryNames);
      const params = new URLSearchParams({ q: query });
      if (codes.length) params.set("countries", codes.join(","));

      const res = await fetch(`/api/geo/airports?${params.toString()}`);
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
        label: s.label,
        value: s.shortLabel,
        sublabel: [s.region, s.country].filter(Boolean).join(" · ") || undefined,
      }));
    },
    [countryNames],
  );

  return (
    <AutocompleteField
      value={value}
      onChange={onChange}
      onSelectOption={
        onSelectOption
          ? (option) => onSelectOption(option.value ?? option.label)
          : undefined
      }
      onBlur={onBlur}
      placeholder={placeholder}
      search={search}
      minChars={3}
      inputClassName={inputClassName}
    />
  );
}
