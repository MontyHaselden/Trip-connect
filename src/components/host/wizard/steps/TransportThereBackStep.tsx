"use client";

import type { TripWizardDraft } from "@/lib/host/wizard/types";

import {
  TransportLegForm,
  emptyTransportLeg,
} from "../shared/TransportLegForm";

export function TransportThereBackStep({
  draft,
  onChange,
}: {
  draft: TripWizardDraft;
  onChange: (draft: TripWizardDraft) => void;
}) {
  const { basics } = draft;
  const defaultDate = basics.startDate || "";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Getting there</h2>
        <p className="mt-1 text-sm text-zinc-600">How is the group travelling to the destination?</p>
        <div className="mt-4 space-y-3">
          {draft.outboundLegs.map((leg, i) => (
            <TransportLegForm
              key={leg.id}
              leg={leg}
              showRemove={draft.outboundLegs.length > 1}
              onRemove={() =>
                onChange({
                  ...draft,
                  outboundLegs: draft.outboundLegs.filter((_, j) => j !== i),
                })
              }
              onChange={(next) =>
                onChange({
                  ...draft,
                  outboundLegs: draft.outboundLegs.map((l, j) => (j === i ? next : l)),
                })
              }
            />
          ))}
          <button
            type="button"
            onClick={() =>
              onChange({
                ...draft,
                outboundLegs: [
                  ...draft.outboundLegs,
                  emptyTransportLeg(defaultDate),
                ],
              })
            }
            className="text-sm font-medium text-zinc-700 underline"
          >
            + Add outbound leg
          </button>
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold">Getting home</h2>
        <p className="mt-1 text-sm text-zinc-600">Return journey legs.</p>
        <div className="mt-4 space-y-3">
          {draft.returnLegs.map((leg, i) => (
            <TransportLegForm
              key={leg.id}
              leg={leg}
              showRemove={draft.returnLegs.length > 1}
              onRemove={() =>
                onChange({
                  ...draft,
                  returnLegs: draft.returnLegs.filter((_, j) => j !== i),
                })
              }
              onChange={(next) =>
                onChange({
                  ...draft,
                  returnLegs: draft.returnLegs.map((l, j) => (j === i ? next : l)),
                })
              }
            />
          ))}
          <button
            type="button"
            onClick={() =>
              onChange({
                ...draft,
                returnLegs: [
                  ...draft.returnLegs,
                  emptyTransportLeg(basics.endDate || defaultDate),
                ],
              })
            }
            className="text-sm font-medium text-zinc-700 underline"
          >
            + Add return leg
          </button>
        </div>
      </div>
    </div>
  );
}
