"use client";

import { useEffect, useState } from "react";

import { TripConfirmModal } from "../shared/TripConfirmModal";
import type { StayPropagationCandidate } from "@/lib/trip-engine/stay-propagation-candidates";

function overrideSummary(candidate: StayPropagationCandidate): string {
  if (candidate.hasPersonalStay && candidate.hasLocationOverride) {
    return "Personal location and stay";
  }
  if (candidate.hasPersonalStay) return "Personal stay";
  return "Different location";
}

export function MainGroupPropagationDialog(props: {
  open: boolean;
  changeLabel: string;
  dateLabel: string;
  candidates: StayPropagationCandidate[];
  saving?: boolean;
  onCancel: () => void;
  onMainGroupOnly: () => void;
  onApplyToSelected: (selectedParticipantIds: string[]) => void;
}) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (props.open) {
      setSelectedIds(new Set(props.candidates.map((candidate) => candidate.participantId)));
    }
  }, [props.open, props.candidates]);

  function toggleParticipant(participantId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(participantId)) next.delete(participantId);
      else next.add(participantId);
      return next;
    });
  }

  const selectedCount = selectedIds.size;

  return (
    <TripConfirmModal
      open={props.open}
      eyebrow="Whole group change"
      title="Apply to participants with their own plan?"
      description={`You changed ${props.changeLabel} for ${props.dateLabel}. Some participants have their own itinerary during these dates.`}
      tone="warning"
      cancelLabel="Cancel"
      confirmLabel={
        selectedCount > 0
          ? `Apply to selected (${selectedCount})`
          : "Apply to selected"
      }
      confirmDisabled={selectedCount === 0}
      confirmLoading={props.saving}
      onCancel={props.onCancel}
      onConfirm={() => props.onApplyToSelected([...selectedIds])}
    >
      <p className="text-sm leading-relaxed text-zinc-600">
        Select whose personal plan should match this main-group change. Anyone left unchecked
        keeps their own itinerary for these dates.
      </p>
      <ul className="mt-3 space-y-2">
        {props.candidates.map((candidate) => {
          const checked = selectedIds.has(candidate.participantId);
          return (
            <li key={candidate.participantId}>
              <button
                type="button"
                onClick={() => toggleParticipant(candidate.participantId)}
                className={[
                  "flex w-full items-start gap-3 rounded-xl border px-3.5 py-3 text-left text-sm transition-colors",
                  checked
                    ? "border-violet-300 bg-violet-50/80"
                    : "border-zinc-200/80 bg-zinc-50/90 hover:border-zinc-300",
                ].join(" ")}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  readOnly
                  className="mt-0.5 rounded border-zinc-400"
                  aria-label={`Apply to ${candidate.participantName}`}
                />
                <span className="min-w-0">
                  <span className="block font-medium text-zinc-900">{candidate.participantName}</span>
                  <span className="block text-zinc-500">{overrideSummary(candidate)}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <button
        type="button"
        onClick={props.onMainGroupOnly}
        className="mt-4 text-sm font-medium text-violet-700 hover:underline"
      >
        Main group only — keep everyone&apos;s personal plans as-is
      </button>
    </TripConfirmModal>
  );
}
