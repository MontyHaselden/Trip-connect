"use client";

import {
  applyTransportToDraft,
  deriveTripDatesFromTransport,
  formatTripDateRange,
} from "@/lib/host/wizard/derive-trip-dates";
import { chainedTransportLeg } from "@/lib/host/wizard/leg-chain";
import type { TripWizardDraft } from "@/lib/host/wizard/types";

import { TransportLegForm } from "../shared/TransportLegForm";

function outboundLegTitle(index: number): string {
  return index === 0 ? "Outbound flight" : `Connection ${index}`;
}

function outboundLegHint(draft: TripWizardDraft, index: number): string | undefined {
  if (index === 0) return undefined;
  const previous = draft.outboundLegs[index - 1];
  const hub = previous?.toCity.trim();
  return hub ? `Continuing from ${hub}` : undefined;
}

function returnLegTitle(index: number): string {
  return index === 0 ? "Return flight" : `Return connection ${index}`;
}

function returnLegHint(draft: TripWizardDraft, index: number): string | undefined {
  if (index === 0) return undefined;
  const previous = draft.returnLegs[index - 1];
  const hub = previous?.toCity.trim();
  return hub ? `Continuing from ${hub}` : undefined;
}

export function TransportThereBackStep({
  draft,
  onChange,
}: {
  draft: TripWizardDraft;
  onChange: (draft: TripWizardDraft) => void;
}) {
  const derivedDates = deriveTripDatesFromTransport(draft);
  const tripRangeLabel = derivedDates
    ? formatTripDateRange(derivedDates.startDate, derivedDates.endDate)
    : null;

  function commit(next: TripWizardDraft) {
    onChange(applyTransportToDraft(next));
  }

  return (
    <div className="space-y-8">
      <div className="rounded-xl border border-zinc-200 bg-zinc-50/80 px-4 py-3 text-sm text-zinc-700">
        {tripRangeLabel ? (
          <p>
            <span className="font-medium text-zinc-900">Trip dates: </span>
            {tripRangeLabel}
            <span className="text-zinc-500">
              {" "}
              — set by your outbound and return flights. Late evening arrivals open the next day at
              home as well.
            </span>
          </p>
        ) : (
          <p>Add your main outbound and return flights — they set when your trip starts and ends.</p>
        )}
      </div>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">Getting there</h2>
          <p className="mt-1 text-sm text-zinc-600">
            Add each flight in order. Connections pick up from where the last leg landed.
          </p>
        </div>
        <div className="space-y-3">
          {draft.outboundLegs.map((leg, i) => (
            <TransportLegForm
              key={leg.id}
              leg={leg}
              legTitle={outboundLegTitle(i)}
              legHint={outboundLegHint(draft, i)}
              showRemove={draft.outboundLegs.length > 1}
              countryNames={draft.basics.destinationCountries}
              onRemove={() =>
                commit({
                  ...draft,
                  outboundLegs: draft.outboundLegs.filter((_, j) => j !== i),
                })
              }
              onChange={(nextLeg) => {
                const outboundLegs = draft.outboundLegs.map((l, j) => (j === i ? nextLeg : l));
                commit({ ...draft, outboundLegs });
              }}
            />
          ))}
          <button
            type="button"
            onClick={() => {
              const previous = draft.outboundLegs[draft.outboundLegs.length - 1];
              commit({
                ...draft,
                outboundLegs: [...draft.outboundLegs, chainedTransportLeg(previous)],
              });
            }}
            className="text-sm font-medium text-zinc-700 underline"
          >
            + Add connection
          </button>
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">Getting home</h2>
          <p className="mt-1 text-sm text-zinc-600">Return journey — usually one flight home.</p>
        </div>
        <div className="space-y-3">
          {draft.returnLegs.map((leg, i) => (
            <TransportLegForm
              key={leg.id}
              leg={leg}
              legTitle={returnLegTitle(i)}
              legHint={returnLegHint(draft, i)}
              showRemove={draft.returnLegs.length > 1}
              countryNames={draft.basics.destinationCountries}
              onRemove={() =>
                commit({
                  ...draft,
                  returnLegs: draft.returnLegs.filter((_, j) => j !== i),
                })
              }
              onChange={(nextLeg) => {
                const returnLegs = draft.returnLegs.map((l, j) => (j === i ? nextLeg : l));
                commit({ ...draft, returnLegs });
              }}
            />
          ))}
          <button
            type="button"
            onClick={() => {
              const previous = draft.returnLegs[draft.returnLegs.length - 1];
              commit({
                ...draft,
                returnLegs: [...draft.returnLegs, chainedTransportLeg(previous)],
              });
            }}
            className="text-sm font-medium text-zinc-700 underline"
          >
            + Add return connection
          </button>
        </div>
      </section>
    </div>
  );
}
