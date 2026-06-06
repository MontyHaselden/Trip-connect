"use client";

import { useEffect } from "react";

import { syncIntercityLegs } from "@/lib/host/wizard/detect-city-moves";
import type { IntercityLegDraft, TripWizardDraft } from "@/lib/host/wizard/types";

import { TransportLegForm } from "../shared/TransportLegForm";

export function IntercityStep({
  draft,
  onChange,
}: {
  draft: TripWizardDraft;
  onChange: (draft: TripWizardDraft) => void;
}) {
  useEffect(() => {
    if (draft.dayPlaces.length === 0) return;
    const synced = syncIntercityLegs(draft.dayPlaces, draft.intercityLegs);
    if (JSON.stringify(synced) !== JSON.stringify(draft.intercityLegs)) {
      onChange({ ...draft, intercityLegs: synced });
    }
  }, [draft.dayPlaces]);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Getting around</h2>
      <p className="text-sm text-zinc-600">
        City-to-city moves detected from your day plan. Fill in transport for each.
      </p>
      {draft.intercityLegs.length === 0 ? (
        <p className="text-sm text-zinc-500">No city changes detected yet.</p>
      ) : (
        <div className="space-y-4">
          {draft.intercityLegs.map((leg, i) => (
            <div key={leg.id}>
              <p className="mb-2 text-sm font-medium">
                {leg.intercityFromCity} → {leg.intercityToCity} on {leg.travelDate}
              </p>
              <TransportLegForm
                leg={leg}
                countryNames={draft.basics.destinationCountries}
                onChange={(next) => {
                  const updated: IntercityLegDraft = {
                    ...next,
                    intercityFromCity: leg.intercityFromCity,
                    intercityToCity: leg.intercityToCity,
                  };
                  onChange({
                    ...draft,
                    intercityLegs: draft.intercityLegs.map((l, j) =>
                      j === i ? updated : l,
                    ),
                  });
                }}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
