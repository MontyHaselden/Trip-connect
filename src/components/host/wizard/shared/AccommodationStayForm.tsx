"use client";

import { useEffect, useState } from "react";

import { HotelNamePicker } from "@/components/geo/HotelNamePicker";
import {
  STAY_TYPES,
  type AccommodationStayDraft,
  type StayType,
} from "@/lib/host/wizard/types";

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
  const [manualAddress, setManualAddress] = useState(false);

  useEffect(() => {
    setManualAddress(false);
  }, [stay.id]);

  function patch(p: Partial<AccommodationStayDraft>) {
    onChange({ ...stay, ...p });
  }

  const fields = (
    <div className="space-y-3">
      <label className="block text-sm">
        <span className="font-medium text-zinc-700">Type</span>
        <select
          value={stay.stayType}
          onChange={(e) => patch({ stayType: e.target.value as StayType })}
          className={`mt-1.5 ${inputClass}`}
        >
          {STAY_TYPES.map((t) => (
            <option key={t} value={t}>
              {t.replace(/_/g, " ")}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm">
        <span className="font-medium text-zinc-700">Hotel or property</span>
        <div className="mt-1.5">
          <HotelNamePicker
            value={stay.name ?? ""}
            onChange={(name) => patch({ name: name || null })}
            onSelectHotel={({ name, address }) => {
              setManualAddress(false);
              patch({ name, address });
            }}
            placeholder="Search hotel on Google Maps…"
            countryNames={countryNames}
            cityHint={cityHint ?? stay.cityLabel}
            inputClassName={inputClass}
          />
        </div>
        <p className="mt-1 text-xs text-zinc-500">
          Search by name — the address fills in when you pick a result. Or type a custom name.
        </p>
      </label>
      {stay.address && !manualAddress ? (
        <div className="rounded-xl border border-zinc-100 bg-zinc-50 px-3 py-2.5">
          <p className="text-xs font-medium text-zinc-500">Address</p>
          <p className="mt-0.5 text-sm leading-relaxed text-zinc-700">{stay.address}</p>
          <button
            type="button"
            onClick={() => setManualAddress(true)}
            className="mt-2 text-xs font-medium text-zinc-500 underline hover:text-zinc-700"
          >
            Edit address manually
          </button>
        </div>
      ) : (
        <label className="block text-sm">
          <span className="font-medium text-zinc-700">
            Address {!stay.name?.trim() ? null : <span className="font-normal text-zinc-400">(optional)</span>}
          </span>
          <input
            value={stay.address ?? ""}
            onChange={(e) => patch({ address: e.target.value || null })}
            placeholder="Custom address if not on Google Maps"
            className={`mt-1.5 ${inputClass}`}
          />
        </label>
      )}
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
      <label className="flex items-center gap-2 text-sm text-zinc-700">
        <input
          type="checkbox"
          checked={stay.multipleInCity}
          onChange={(e) => patch({ multipleInCity: e.target.checked })}
          className="rounded border-zinc-300"
        />
        Staying in more than one place here
      </label>
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
