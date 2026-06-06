"use client";

import { useEffect } from "react";

import { suggestAccommodationStays } from "@/lib/host/wizard/detect-city-moves";
import {
  STAY_TYPES,
  type AccommodationStayDraft,
  type StayType,
  type TripWizardDraft,
  newId,
} from "@/lib/host/wizard/types";

export function AccommodationStep({
  draft,
  onChange,
}: {
  draft: TripWizardDraft;
  onChange: (draft: TripWizardDraft) => void;
}) {
  const { accommodationStays, dayPlaces } = draft;

  useEffect(() => {
    if (accommodationStays.length > 0 || dayPlaces.length === 0) return;
    const suggested = suggestAccommodationStays(dayPlaces);
    onChange({
      ...draft,
      accommodationStays: suggested.map((s) => ({
        id: newId(),
        cityLabel: s.cityLabel,
        stayType: "hotel" as StayType,
        name: null,
        url: null,
        address: null,
        phone: null,
        checkInDate: s.checkInDate,
        checkOutDate: s.checkOutDate,
        notes: null,
        isHomestayGroup: false,
        multipleInCity: false,
      })),
    });
  }, [dayPlaces.length, accommodationStays.length]);

  function updateStay(i: number, patch: Partial<AccommodationStayDraft>) {
    onChange({
      ...draft,
      accommodationStays: accommodationStays.map((s, j) =>
        j === i ? { ...s, ...patch } : s,
      ),
    });
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Accommodation</h2>
      <p className="text-sm text-zinc-600">
        Where is the group staying in each city? Dates are prefilled from your day plan.
      </p>
      {accommodationStays.length === 0 ? (
        <p className="text-sm text-amber-700">Complete Dates & Places first.</p>
      ) : (
        <div className="space-y-4">
          {accommodationStays.map((stay, i) => (
            <div key={stay.id} className="rounded-xl border border-zinc-200 p-4 space-y-3">
              <h3 className="font-medium">Staying in {stay.cityLabel}</h3>
              <p className="text-xs text-zinc-500">
                {stay.checkInDate} – {stay.checkOutDate}
              </p>
              <label className="block text-sm">
                <span className="font-medium">Type</span>
                <select
                  value={stay.stayType}
                  onChange={(e) =>
                    updateStay(i, { stayType: e.target.value as StayType })
                  }
                  className="mt-1 h-10 w-full rounded-lg border border-zinc-200 px-2"
                >
                  {STAY_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="font-medium">Name</span>
                <input
                  value={stay.name ?? ""}
                  onChange={(e) => updateStay(i, { name: e.target.value || null })}
                  className="mt-1 h-10 w-full rounded-lg border border-zinc-200 px-2"
                />
              </label>
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="block text-sm">
                  <span className="font-medium">Check-in</span>
                  <input
                    type="date"
                    value={stay.checkInDate}
                    onChange={(e) => updateStay(i, { checkInDate: e.target.value })}
                    className="mt-1 h-10 w-full rounded-lg border border-zinc-200 px-2"
                  />
                </label>
                <label className="block text-sm">
                  <span className="font-medium">Check-out</span>
                  <input
                    type="date"
                    value={stay.checkOutDate}
                    onChange={(e) => updateStay(i, { checkOutDate: e.target.value })}
                    className="mt-1 h-10 w-full rounded-lg border border-zinc-200 px-2"
                  />
                </label>
              </div>
              <label className="block text-sm">
                <span className="font-medium">Address</span>
                <input
                  value={stay.address ?? ""}
                  onChange={(e) => updateStay(i, { address: e.target.value || null })}
                  className="mt-1 h-10 w-full rounded-lg border border-zinc-200 px-2"
                />
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={stay.multipleInCity}
                  onChange={(e) => updateStay(i, { multipleInCity: e.target.checked })}
                />
                Staying in more than one place here
              </label>
              {stay.stayType === "homestay" ? (
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={stay.isHomestayGroup}
                    onChange={(e) => updateStay(i, { isHomestayGroup: e.target.checked })}
                  />
                  Each student stays with a different host family
                </label>
              ) : null}
            </div>
          ))}
          <button
            type="button"
            onClick={() => {
              const city = dayPlaces.find((d) => d.primaryCity)?.primaryCity ?? "City";
              onChange({
                ...draft,
                accommodationStays: [
                  ...accommodationStays,
                  {
                    id: newId(),
                    cityLabel: city,
                    stayType: "hotel",
                    name: null,
                    url: null,
                    address: null,
                    phone: null,
                    checkInDate: draft.basics.startDate,
                    checkOutDate: draft.basics.endDate,
                    notes: null,
                    isHomestayGroup: false,
                    multipleInCity: false,
                  },
                ],
              });
            }}
            className="text-sm font-medium underline"
          >
            + Add another stay
          </button>
        </div>
      )}
    </div>
  );
}
