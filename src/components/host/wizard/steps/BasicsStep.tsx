"use client";

import type { TripWizardDraft } from "@/lib/host/wizard/types";

import { CountryPicker } from "@/components/geo/CountryPicker";
import { PlacePicker } from "@/components/geo/PlacePicker";
import { TripTimezoneNote } from "@/components/geo/TripTimezoneNote";

export function BasicsStep({
  draft,
  onChange,
}: {
  draft: TripWizardDraft;
  onChange: (draft: TripWizardDraft) => void;
}) {
  const b = draft.basics;

  function setBasics(patch: Partial<typeof b>) {
    onChange({ ...draft, basics: { ...b, ...patch } });
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Trip basics</h2>
      <p className="text-sm text-zinc-600">
        Core details for your trip. Trip dates are set automatically from your outbound and return
        flights in the next step.
      </p>
      <label className="block text-sm">
        <span className="font-medium">Trip name</span>
        <input
          value={b.name}
          onChange={(e) => setBasics({ name: e.target.value })}
          className="mt-1 h-11 w-full rounded-xl border border-zinc-200 px-3"
        />
      </label>
      <label className="block text-sm">
        <span className="font-medium">School name</span>
        <input
          value={b.schoolName}
          onChange={(e) => setBasics({ schoolName: e.target.value })}
          className="mt-1 h-11 w-full rounded-xl border border-zinc-200 px-3"
        />
      </label>
      <CountryPicker
        value={b.destinationCountries}
        onChange={(destinationCountries) => setBasics({ destinationCountries })}
        hint="Official country names — used for weather and place search."
      />
      <TripTimezoneNote
        countries={b.destinationCountries}
        cities={draft.dayPlaces.map((d) => d.primaryCity).filter(Boolean)}
        departureCity={b.departureCity}
        currentTimezone={b.timezone}
        onTimezoneResolved={(timezone) => setBasics({ timezone })}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="font-medium">Main departure city</span>
          <div className="mt-1">
            <PlacePicker
              value={b.departureCity}
              onChange={(departureCity) => setBasics({ departureCity })}
              placeholder="e.g. Christchurch, New Zealand"
            />
          </div>
        </label>
        <label className="block text-sm">
          <span className="font-medium">Main return city</span>
          <div className="mt-1">
            <PlacePicker
              value={b.returnCity}
              onChange={(returnCity) => setBasics({ returnCity })}
              placeholder="Usually same as departure city"
            />
          </div>
        </label>
      </div>
    </div>
  );
}
