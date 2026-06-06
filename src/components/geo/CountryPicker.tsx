"use client";

import { useMemo, useState } from "react";

import { COUNTRIES, searchCountries } from "@/lib/geo/countries";

import { AutocompleteField, type AutocompleteOption } from "./AutocompleteField";

export function CountryPicker({
  value,
  onChange,
  label = "Destination countries",
  hint,
}: {
  value: string[];
  onChange: (countries: string[]) => void;
  label?: string;
  hint?: string;
}) {
  const [draft, setDraft] = useState("");

  const search = useMemo(
    () => (query: string) => {
      const matches = searchCountries(query, 14);
      const selected = new Set(value.map((v) => v.toLowerCase()));
      return matches
        .filter((c) => !selected.has(c.name.toLowerCase()))
        .map(
          (c): AutocompleteOption => ({
            id: c.code,
            label: c.name,
            sublabel: c.code,
          }),
        );
    },
    [value],
  );

  function addCountry(name: string) {
    const canonical =
      COUNTRIES.find((c) => c.name.toLowerCase() === name.trim().toLowerCase())?.name ??
      name.trim();
    if (!canonical) return;
    if (value.some((v) => v.toLowerCase() === canonical.toLowerCase())) return;
    onChange([...value, canonical]);
    setDraft("");
  }

  return (
    <div className="space-y-2">
      <span className="text-sm font-medium">{label}</span>
      {hint ? <p className="text-xs text-zinc-500">{hint}</p> : null}
      {value.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {value.map((country) => (
            <span
              key={country}
              className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-3 py-1 text-sm text-zinc-800"
            >
              {country}
              <button
                type="button"
                aria-label={`Remove ${country}`}
                onClick={() => onChange(value.filter((c) => c !== country))}
                className="text-zinc-500 hover:text-zinc-900"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      ) : null}
      <AutocompleteField
        value={draft}
        onChange={setDraft}
        placeholder="Type a country name…"
        search={search}
        minChars={0}
        debounceMs={0}
        onSelectOption={(opt) => addCountry(opt.label)}
      />
      <p className="text-xs text-zinc-500">
        Pick from the list for official country names. You can add more than one destination.
      </p>
    </div>
  );
}
