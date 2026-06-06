"use client";

import type { TripWizardDraft } from "@/lib/host/wizard/types";

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
        Core details for your trip. Buffer days before and after can be added in the next steps.
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
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="font-medium">Start date</span>
          <input
            type="date"
            value={b.startDate}
            onChange={(e) => setBasics({ startDate: e.target.value })}
            className="mt-1 h-11 w-full rounded-xl border border-zinc-200 px-3"
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium">End date</span>
          <input
            type="date"
            value={b.endDate}
            onChange={(e) => setBasics({ endDate: e.target.value })}
            className="mt-1 h-11 w-full rounded-xl border border-zinc-200 px-3"
          />
        </label>
      </div>
      <label className="block text-sm">
        <span className="font-medium">Destination countries</span>
        <input
          value={b.destinationCountries.join(", ")}
          onChange={(e) =>
            setBasics({
              destinationCountries: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
            })
          }
          placeholder="Japan"
          className="mt-1 h-11 w-full rounded-xl border border-zinc-200 px-3"
        />
      </label>
      <label className="block text-sm">
        <span className="font-medium">Languages</span>
        <input
          value={b.destinationLanguages.join(", ")}
          onChange={(e) =>
            setBasics({
              destinationLanguages: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
            })
          }
          placeholder="Japanese"
          className="mt-1 h-11 w-full rounded-xl border border-zinc-200 px-3"
        />
      </label>
      <label className="block text-sm">
        <span className="font-medium">Timezone</span>
        <input
          value={b.timezone}
          onChange={(e) => setBasics({ timezone: e.target.value })}
          className="mt-1 h-11 w-full rounded-xl border border-zinc-200 px-3"
        />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="font-medium">Main departure city</span>
          <input
            value={b.departureCity}
            onChange={(e) => setBasics({ departureCity: e.target.value })}
            className="mt-1 h-11 w-full rounded-xl border border-zinc-200 px-3"
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium">Main return city</span>
          <input
            value={b.returnCity}
            onChange={(e) => setBasics({ returnCity: e.target.value })}
            className="mt-1 h-11 w-full rounded-xl border border-zinc-200 px-3"
          />
        </label>
      </div>
    </div>
  );
}
