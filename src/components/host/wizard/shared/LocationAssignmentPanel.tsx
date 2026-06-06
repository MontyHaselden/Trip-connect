"use client";

import { PlacePicker } from "@/components/geo/PlacePicker";
import {
  assignmentLabel,
  type LocationStayDraft,
} from "@/lib/host/wizard/location-stays";

export function LocationAssignmentPanel({
  stepIndex,
  location,
  onLocationChange,
  rangeStart,
  rangeEnd,
  onConfirm,
  onSkip,
  canSkip,
  countryNames,
}: {
  stepIndex: number;
  location: string;
  onLocationChange: (location: string) => void;
  rangeStart: string;
  rangeEnd: string;
  onConfirm: () => void;
  onSkip?: () => void;
  canSkip?: boolean;
  countryNames: string[];
}) {
  const label = assignmentLabel(stepIndex);
  const rangeReady = Boolean(rangeStart && rangeEnd && location.trim());

  return (
    <div className="rounded-xl border border-sky-200 bg-sky-50/80 p-4 space-y-4">
      <div>
        <h3 className="text-base font-semibold text-sky-950">{label}</h3>
        <p className="mt-1 text-sm text-sky-900/90">
          Choose where the group is staying, then tap the <strong>first</strong> and{" "}
          <strong>last</strong> day of that stay on the calendar. The first and last days are
          automatically half-filled for travel in and out.
        </p>
      </div>

      <label className="block text-sm">
        <span className="font-medium text-zinc-800">Location</span>
        <div className="mt-1">
          <PlacePicker
            value={location}
            onChange={onLocationChange}
            placeholder="City or region"
            countryNames={countryNames}
            inputClassName="h-11 w-full rounded-xl border border-zinc-200 px-3 text-sm focus:border-zinc-400 focus:outline-none"
          />
        </div>
      </label>

      {rangeStart && rangeEnd ? (
        <p className="text-sm font-medium text-zinc-800">
          {rangeStart === rangeEnd
            ? `One day selected: ${rangeStart}`
            : `${rangeStart} → ${rangeEnd}`}
        </p>
      ) : rangeStart ? (
        <p className="text-sm text-zinc-600">Tap the last day of this stay on the calendar.</p>
      ) : (
        <p className="text-sm text-zinc-600">Tap the first day of this stay on the calendar.</p>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!rangeReady}
          onClick={onConfirm}
          className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
        >
          Confirm {label.toLowerCase()}
        </button>
        {canSkip && onSkip ? (
          <button
            type="button"
            onClick={onSkip}
            className="rounded-xl border border-zinc-300 px-4 py-2 text-sm text-zinc-700 hover:bg-white"
          >
            Skip — no more locations
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function ConfirmedStaysList({
  stays,
  onRemove,
}: {
  stays: LocationStayDraft[];
  onRemove: (index: number) => void;
}) {
  if (!stays.length) return null;

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-zinc-800">Confirmed stays</h3>
      <ul className="space-y-1">
        {stays.map((stay, i) => (
          <li
            key={`${stay.location}-${stay.startDate}-${stay.endDate}`}
            className="flex items-center justify-between gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
          >
            <span>
              <strong>{stay.location}</strong> ·{" "}
              {stay.startDate === stay.endDate
                ? stay.startDate
                : `${stay.startDate} → ${stay.endDate}`}
            </span>
            <button
              type="button"
              onClick={() => onRemove(i)}
              className="text-xs text-red-600 hover:underline"
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
