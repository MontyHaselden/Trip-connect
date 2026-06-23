"use client";

import { TripConfirmModal } from "../shared/TripConfirmModal";
import type { StayPropagationCandidate } from "@/lib/trip-engine/stay-propagation-candidates";

export function StayPropagationDialog(props: {
  open: boolean;
  stayName: string;
  dateLabel: string;
  candidates: StayPropagationCandidate[];
  saving?: boolean;
  onCancel: () => void;
  onMainGroupOnly: () => void;
  onApplyToAll: () => void;
}) {
  const names = props.candidates.map((c) => c.participantName.split(/\s+/)[0] || c.participantName);

  return (
    <TripConfirmModal
      open={props.open}
      eyebrow="Group stay change"
      title="Apply to other participants?"
      description={`You changed ${props.stayName.trim() || "this stay"} for ${props.dateLabel}. Some participants have their own location or stay overrides during the same dates.`}
      tone="warning"
      cancelLabel="Cancel"
      confirmLabel="Apply to everyone on trip"
      confirmLoading={props.saving}
      onCancel={props.onCancel}
      onConfirm={props.onApplyToAll}
    >
      <p className="text-sm leading-relaxed text-zinc-600">
        Only people actually on the trip during these dates are listed. Participants who join later
        or are away (for example a homestay on different dates) are not included.
      </p>
      <ul className="mt-3 space-y-2">
        {props.candidates.map((candidate) => (
          <li
            key={candidate.participantId}
            className="rounded-xl border border-zinc-200/80 bg-zinc-50/90 px-3.5 py-3 text-sm text-zinc-800"
          >
            <span className="font-medium text-zinc-900">{candidate.participantName}</span>
            <span className="text-zinc-500">
              {candidate.hasPersonalStay && candidate.hasLocationOverride
                ? " · personal location and stay"
                : candidate.hasPersonalStay
                  ? " · personal stay"
                  : " · different location"}
            </span>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={props.onMainGroupOnly}
        className="mt-4 text-sm font-medium text-violet-700 hover:underline"
      >
        Main group only ({names.length ? `keep ${names.join(", ")} as-is` : "no personal changes"})
      </button>
    </TripConfirmModal>
  );
}
