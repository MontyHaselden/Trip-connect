"use client";

import { HotelNamePicker } from "@/components/geo/HotelNamePicker";
import { PlacePicker } from "@/components/geo/PlacePicker";
import {
  accommodationSearchMode,
  inferCityLabelFromAddress,
  sanitizeCityHint,
  usesGoogleMapsSearch,
} from "@/lib/geo/accommodation-search";
import {
  defaultHomestayGroupForType,
  PICKABLE_STAY_TYPES,
  stayTypeLabel,
} from "@/lib/host/accommodation/stay-type-labels";
import type { AccommodationStayDraft, StayType } from "@/lib/host/wizard/types";

const inputClass =
  "h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm shadow-sm transition focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-100";

export function AccommodationStayForm({
  stay,
  onChange,
  embedded = false,
  countryNames = [],
  cityHint,
}: {
  stay: AccommodationStayDraft;
  onChange: (stay: AccommodationStayDraft) => void;
  embedded?: boolean;
  countryNames?: string[];
  cityHint?: string;
}) {
  function patch(p: Partial<AccommodationStayDraft>) {
    onChange({ ...stay, ...p });
  }

  const searchMode = accommodationSearchMode(stay.stayType);
  const mapSearch = usesGoogleMapsSearch(stay.stayType);
  const effectiveCity = sanitizeCityHint(cityHint ?? stay.cityLabel);

  const fields = (
    <div className="space-y-3">
      <label className="block text-sm">
        <span className="font-medium text-zinc-700">Type</span>
        <select
          value={stay.stayType}
          onChange={(e) => {
            const nextType = e.target.value as StayType;
            patch({
              stayType: nextType,
              isHomestayGroup: defaultHomestayGroupForType(nextType),
            });
          }}
          className={`mt-1.5 ${inputClass}`}
        >
          {PICKABLE_STAY_TYPES.map((t) => (
            <option key={t} value={t}>
              {stayTypeLabel(t)}
            </option>
          ))}
        </select>
      </label>

      {mapSearch ? (
        <label className="block text-sm">
          <span className="font-medium text-zinc-700">{searchMode.fieldLabel}</span>
          <div className="mt-1.5">
            <HotelNamePicker
              value={stay.name ?? ""}
              onChange={(name) => patch({ name: name || null })}
              onSelectHotel={({ name, address, cityLabel: pickedCity, placeId, lat, lng }) => {
                const cityLabel =
                  pickedCity?.trim() ||
                  inferCityLabelFromAddress(address) ||
                  stay.cityLabel;
                patch({
                  name,
                  address,
                  cityLabel,
                  googlePlaceId: placeId ?? null,
                  latitude: lat ?? null,
                  longitude: lng ?? null,
                });
              }}
              stayType={stay.stayType}
              countryNames={countryNames}
              stayCity={effectiveCity}
              inputClassName={inputClass}
            />
          </div>
          <p className="mt-1 text-xs text-zinc-500">
            Search on Google Maps — pick a result to save the place.
          </p>
        </label>
      ) : null}

      {mapSearch && stay.name?.trim() ? (
        <label className="block text-sm">
          <span className="font-medium text-zinc-700">Region name</span>
          <input
            value={stay.cityLabel === "TBC" ? "" : stay.cityLabel}
            onChange={(e) => patch({ cityLabel: e.target.value.trim() || "TBC" })}
            placeholder="e.g. Patong, Phuket"
            className={`mt-1.5 ${inputClass}`}
          />
          <p className="mt-1 text-xs text-zinc-500">
            Shown on the calendar — override if Google picked the wrong district.
          </p>
        </label>
      ) : null}

      {!mapSearch ? (
        <>
          <label className="block text-sm">
            <span className="font-medium text-zinc-700">City</span>
            <div className="mt-1.5">
              <PlacePicker
                value={stay.cityLabel === "TBC" ? "" : stay.cityLabel}
                onChange={(cityLabel) => patch({ cityLabel: cityLabel || "TBC" })}
                countryNames={countryNames}
                inputClassName={inputClass}
                placeholder="Which city is this stay in?"
              />
            </div>
          </label>
          <label className="block text-sm">
            <span className="font-medium text-zinc-700">Property name</span>
            <input
              value={stay.name ?? ""}
              onChange={(e) => patch({ name: e.target.value || null })}
              placeholder="Name of stay"
              className={`mt-1.5 ${inputClass}`}
            />
          </label>
        </>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="font-medium text-zinc-700">Check-in</span>
          <input
            type="date"
            value={stay.checkInDate}
            onChange={(e) => patch({ checkInDate: e.target.value })}
            className={`mt-1.5 ${inputClass}`}
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-zinc-700">Check-out</span>
          <input
            type="date"
            value={stay.checkOutDate}
            onChange={(e) => patch({ checkOutDate: e.target.value })}
            className={`mt-1.5 ${inputClass}`}
          />
        </label>
      </div>

      {stay.stayType === "homestay" ? (
        <label className="flex items-center gap-2 text-sm text-zinc-700">
          <input
            type="checkbox"
            checked={stay.isHomestayGroup}
            onChange={(e) => patch({ isHomestayGroup: e.target.checked })}
            className="rounded border-zinc-300"
          />
          Each student stays with a different host family
        </label>
      ) : null}
    </div>
  );

  if (embedded) return fields;

  return (
    <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-sm">{fields}</div>
  );
}
