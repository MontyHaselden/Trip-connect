"use client";

import { useEffect, useMemo, useState } from "react";

import { formatMoney, parseMoneyInput } from "@/lib/trip-engine/cost-ledger/format-money";
import { splitAmountEvenly } from "@/lib/trip-engine/cost-ledger/smart-split";
import { TripConfirmModal } from "../shared/TripConfirmModal";

export type FinancePriceParticipant = {
  id: string;
  fullName: string;
  amountCents: number | null;
  isPinned: boolean;
};

export type FinancePriceAllocation = {
  participantId: string;
  amountCents: number;
};

type PricingMode = "perPerson" | "totalSplit";

export function FinancePerPersonPricesModal(props: {
  open: boolean;
  lineDescription: string;
  linkedHint?: string | null;
  currency: string;
  participants: FinancePriceParticipant[];
  applyError?: string | null;
  onCancel: () => void;
  onApply: (allocations: FinancePriceAllocation[]) => void | Promise<void>;
}) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [amountInput, setAmountInput] = useState("");
  const [pricingMode, setPricingMode] = useState<PricingMode>("perPerson");

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
    setPricingMode("perPerson");
  }, [props.open, props.participants]);

  function toggleParticipant(participantId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(participantId)) next.delete(participantId);
      else next.add(participantId);
      return next;
    });
  }

  const selectedCount = selectedIds.size;
  const inputCents = parseMoneyInput(amountInput.trim(), props.currency);

  const allocations = useMemo((): FinancePriceAllocation[] => {
    if (inputCents <= 0 || selectedCount === 0) return [];
    const ids = [...selectedIds];
    if (pricingMode === "perPerson") {
      return ids.map((participantId) => ({
        participantId,
        amountCents: inputCents,
      }));
    }
    const split = splitAmountEvenly(inputCents, ids);
    return ids.map((participantId) => ({
      participantId,
      amountCents: split[participantId] ?? 0,
    }));
  }, [inputCents, selectedIds, pricingMode]);

  const previewTotal = allocations.reduce((sum, row) => sum + row.amountCents, 0);
  const perPersonPreview =
    pricingMode === "totalSplit" && allocations.length
      ? allocations[0]!.amountCents
      : inputCents;
  const splitIsEven =
    pricingMode === "totalSplit" &&
    allocations.length > 0 &&
    allocations.every((row) => row.amountCents === allocations[0]!.amountCents);

  function handleApply() {
    if (allocations.length === 0) return;
    void props.onApply(allocations);
  }

  const confirmLabel =
    selectedCount > 0 && inputCents > 0
      ? pricingMode === "perPerson"
        ? `Apply ${formatMoney(inputCents, props.currency)} × ${selectedCount}`
        : splitIsEven
          ? `Apply ${formatMoney(previewTotal, props.currency)} ÷ ${selectedCount}`
          : `Apply ${formatMoney(previewTotal, props.currency)} split ${selectedCount} ways`
      : "Apply";

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
      confirmLabel={confirmLabel}
      confirmDisabled={allocations.length === 0}
      allowDismissWhileLoading
      onCancel={props.onCancel}
      onConfirm={handleApply}
    >
      {props.applyError ? (
        <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {props.applyError}
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-1 rounded-xl border border-zinc-200 bg-zinc-100/80 p-1">
        <button
          type="button"
          onClick={() => setPricingMode("perPerson")}
          className={[
            "rounded-lg px-2 py-2 text-[11px] font-semibold transition",
            pricingMode === "perPerson"
              ? "bg-white text-violet-800 shadow-sm"
              : "text-zinc-600 hover:text-zinc-900",
          ].join(" ")}
        >
          Amount per person
        </button>
        <button
          type="button"
          onClick={() => setPricingMode("totalSplit")}
          className={[
            "rounded-lg px-2 py-2 text-[11px] font-semibold transition",
            pricingMode === "totalSplit"
              ? "bg-white text-violet-800 shadow-sm"
              : "text-zinc-600 hover:text-zinc-900",
          ].join(" ")}
        >
          Total split
        </button>
      </div>

      <label className="mt-3 block">
        <span className="text-xs font-medium text-zinc-900">
          {pricingMode === "perPerson" ? "Amount per person" : "Total to split"}
        </span>
        <input
          type="text"
          inputMode="decimal"
          value={amountInput}
          onChange={(e) => setAmountInput(e.target.value)}
          placeholder={props.currency === "JPY" ? "0" : "0.00"}
          className="mt-1.5 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 tabular-nums shadow-inner placeholder:text-zinc-400 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100"
          autoFocus
        />
      </label>

      {previewTotal > 0 && selectedCount > 0 ? (
        <p className="mt-2 text-xs text-zinc-800">
          {pricingMode === "perPerson" ? (
            <>
              Row total will include{" "}
              <span className="font-semibold text-zinc-900">
                {formatMoney(previewTotal, props.currency)}
              </span>{" "}
              for {selectedCount} selected.
            </>
          ) : splitIsEven ? (
            <>
              <span className="font-semibold text-zinc-900">
                {formatMoney(perPersonPreview, props.currency)}
              </span>{" "}
              each for {selectedCount} selected (
              {formatMoney(previewTotal, props.currency)} total).
            </>
          ) : (
            <>
              Split{" "}
              <span className="font-semibold text-zinc-900">
                {formatMoney(previewTotal, props.currency)}
              </span>{" "}
              across {selectedCount} selected — amounts vary by a cent where needed.
            </>
          )}
        </p>
      ) : null}

      <div className="mt-4 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-900">
          Who
          <span className="ml-2 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold tabular-nums text-violet-800">
            {selectedCount} selected
          </span>
        </p>
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
          const previewCents =
            checked && inputCents > 0
              ? allocations.find((row) => row.participantId === participant.id)?.amountCents
              : null;
          return (
            <li key={participant.id}>
              <button
                type="button"
                onClick={() => toggleParticipant(participant.id)}
                className={[
                  "flex w-full items-center gap-3 rounded-xl border px-3.5 py-2.5 text-left text-sm text-zinc-900 transition-colors",
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
                {previewCents != null && previewCents > 0 ? (
                  <span className="shrink-0 text-xs tabular-nums text-violet-700">
                    {formatMoney(previewCents, props.currency)}
                  </span>
                ) : participant.amountCents != null && participant.amountCents > 0 ? (
                  <span className="shrink-0 text-xs tabular-nums text-zinc-700">
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
