"use client";

import { useEffect, useState } from "react";

import { PlacePicker } from "@/components/geo/PlacePicker";
import type { AccommodationLocationConflict } from "@/lib/host/setup/day-selection-setup";
import { shortCityName } from "@/lib/host/setup/location-range-display";

import { tripFieldClass } from "../shared/TripInput";
import { TripConfirmModal } from "../shared/TripConfirmModal";

export function AccommodationLocationConflictDialog(props: {
  open: boolean;
  stayCity: string;
  stayName?: string;
  keepCityLabel?: string | null;
  conflicts: AccommodationLocationConflict[];
  saving?: boolean;
  formatRange: (start: string, end: string) => string;
  onCancel: () => void;
  onConfirm: () => void;
  onCityChange: (city: string) => void;
}) {
  const {
    open,
    stayCity,
    stayName,
    keepCityLabel,
    conflicts,
    saving,
    formatRange,
    onCancel,
    onConfirm,
    onCityChange,
  } = props;
  const [editingCity, setEditingCity] = useState(false);
  const cityLabel = shortCityName(stayCity) || stayCity.trim();

  useEffect(() => {
    if (open) setEditingCity(false);
  }, [open]);

  return (
    <TripConfirmModal
      open={open}
      eyebrow="Location conflict"
      title="Replace existing locations?"
      description={`This stay is in ${cityLabel}${stayName?.trim() ? ` (${stayName.trim()})` : ""}, but some selected days already have different locations.`}
      tone="warning"
      cancelLabel="Cancel"
      confirmLabel="Apply stay"
      confirmLoading={saving}
      onCancel={() => {
        setEditingCity(false);
        onCancel();
      }}
      onConfirm={onConfirm}
    >
      <ul className="space-y-2">
        {conflicts.map((conflict) => (
          <li
            key={`${conflict.rangeStart}-${conflict.existingLocation}-${conflict.existingAccommodation ?? ""}`}
            className="rounded-xl border border-zinc-200/80 bg-zinc-50/90 px-3.5 py-3 text-sm leading-relaxed text-zinc-800"
          >
            <p className="font-medium text-zinc-900">
              {formatRange(conflict.rangeStart, conflict.rangeEnd)}
            </p>
            <p className="mt-1 text-zinc-600">
              Currently{" "}
              <span className="font-medium text-zinc-800">
                {shortCityName(conflict.existingLocation) || conflict.existingLocation}
              </span>
              {conflict.existingAccommodation?.trim()
                ? ` · ${conflict.existingAccommodation.trim()}`
                : null}
            </p>
          </li>
        ))}
      </ul>
      <div className="mt-4 text-sm leading-relaxed text-zinc-600">
        {editingCity ? (
          <div className="space-y-2">
            <p>Location label to apply on selected days:</p>
            <PlacePicker
              value={stayCity}
              onChange={(city) => onCityChange(city)}
              placeholder="e.g. Queenstown"
              inputClassName={tripFieldClass}
            />
            <button
              type="button"
              onClick={() => setEditingCity(false)}
              className="text-xs font-medium text-violet-700 hover:underline"
            >
              Done editing
            </button>
          </div>
        ) : (
          <p>
            Applying will replace location labels on the selected days with{" "}
            <span className="font-medium text-zinc-900">{cityLabel}</span>
            <button
              type="button"
              onClick={() => setEditingCity(true)}
              className="ml-1.5 text-xs font-medium text-violet-700 hover:underline"
            >
              Edit
            </button>
            .
          </p>
        )}
        {keepCityLabel ? (
          <button
            type="button"
            onClick={() => onCityChange(keepCityLabel)}
            className="mt-2 font-medium text-violet-800 hover:underline"
          >
            Keep as {keepCityLabel}?
          </button>
        ) : null}
      </div>
    </TripConfirmModal>
  );
}
