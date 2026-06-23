"use client";

import { useEffect, useState } from "react";

import { formatMoney, parseMoneyInput } from "@/lib/trip-engine/cost-ledger/format-money";
import { TripConfirmModal } from "../shared/TripConfirmModal";

export type FinancePriceParticipant = {
  id: string;
  fullName: string;
  amountCents: number | null;
  isPinned: boolean;
};

export function FinancePerPersonPricesModal(props: {
  open: boolean;
  lineDescription: string;
  linkedHint?: string | null;
  currency: string;
  participants: FinancePriceParticipant[];
  saving?: boolean;
  onCancel: () => void;
  onApply: (participantIds: string[], amountCents: number) => void;
}) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [amountInput, setAmountInput] = useState("");

  useEffect(() => {
    if (!props.open) return;
    const preselected = props.participants
      .filter((p) => p.isPinned)
      .map((p) => p.id);
    setSelectedIds(
      new Set(
        preselected.length ? preselected : props.participants.map((p) => p.id),
      ),
    );
    setAmountInput("");
  }, [props.open]);

  function toggleParticipant(participantId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(participantId)) next.delete(participantId);
      else next.add(participantId);
      return next;
    });
  }

  function handleApply() {
    const cents = parseMoneyInput(amountInput.trim(), props.currency);
    if (cents <= 0 || selectedIds.size === 0) return;
    props.onApply([...selectedIds], cents);
  }

  const selectedCount = selectedIds.size;
  const amountCents = parseMoneyInput(amountInput.trim(), props.currency);
  const previewTotal = amountCents > 0 ? amountCents * selectedCount : 0;

  return (
    <TripConfirmModal
      open={props.open}
      wide
      eyebrow="Per-person prices"
      title={props.lineDescription}
      description={
        props.linkedHint ??
        "Choose who gets this fare. Apply again with a different amount for another fare tier."
      }
      confirmLabel={
        selectedCount > 0 && amountCents > 0
          ? `Apply ${formatMoney(amountCents, props.currency)} × ${selectedCount}`
          : "Apply"
      }
      confirmDisabled={selectedCount === 0 || amountCents <= 0}
      confirmLoading={props.saving}
      onCancel={props.onCancel}
      onConfirm={handleApply}
    >
      <label className="block">
        <span className="text-xs font-medium text-zinc-700">Amount per person</span>
        <input
          type="text"
          inputMode="decimal"
          value={amountInput}
          onChange={(e) => setAmountInput(e.target.value)}
          placeholder={props.currency === "JPY" ? "0" : "0.00"}
          className="mt-1.5 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm tabular-nums shadow-inner focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100"
          autoFocus
        />
      </label>
      {previewTotal > 0 ? (
        <p className="mt-2 text-xs text-zinc-600">
          Row total will include{" "}
          <span className="font-semibold text-zinc-900">
            {formatMoney(previewTotal, props.currency)}
          </span>{" "}
          for this group ({selectedCount} people).
        </p>
      ) : null}

      <div className="mt-4 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Who</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setSelectedIds(new Set(props.participants.map((p) => p.id)))}
            className="text-[11px] font-medium text-violet-700 hover:underline"
          >
            Select all
          </button>
          <button
            type="button"
            onClick={() => setSelectedIds(new Set())}
            className="text-[11px] font-medium text-zinc-500 hover:underline"
          >
            Clear
          </button>
        </div>
      </div>

      <ul className="mt-2 max-h-56 space-y-2 overflow-y-auto pr-1">
        {props.participants.map((participant) => {
          const checked = selectedIds.has(participant.id);
          return (
            <li key={participant.id}>
              <button
                type="button"
                onClick={() => toggleParticipant(participant.id)}
                className={[
                  "flex w-full items-center gap-3 rounded-xl border px-3.5 py-2.5 text-left text-sm transition-colors",
                  checked
                    ? "border-violet-300 bg-violet-50/80"
                    : "border-zinc-200/80 bg-zinc-50/90 hover:border-zinc-300",
                ].join(" ")}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  readOnly
                  className="rounded border-zinc-400"
                  aria-label={`Select ${participant.fullName}`}
                />
                <span className="min-w-0 flex-1 font-medium text-zinc-900">
                  {participant.fullName}
                </span>
                {participant.amountCents != null && participant.amountCents > 0 ? (
                  <span className="shrink-0 text-xs tabular-nums text-zinc-500">
                    {formatMoney(participant.amountCents, props.currency)}
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
    </TripConfirmModal>
  );
}
