"use client";

import { useState } from "react";

import { parseMoneyInput } from "@/lib/trip-engine/cost-ledger/format-money";

export function FinanceBulkFillBar(props: {
  selectedRowLabel: string;
  linkedHint?: string | null;
  selectedParticipantCount: number;
  eligibleParticipantCount: number;
  currency: string;
  onApply: (amountCents: number) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onDone: () => void;
}) {
  const [amountInput, setAmountInput] = useState("");

  function apply() {
    const cents = parseMoneyInput(amountInput.trim(), props.currency);
    if (cents <= 0) return;
    props.onApply(cents);
    setAmountInput("");
  }

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-violet-300 bg-violet-100/90 px-3 py-2.5">
      <div className="min-w-0">
        <p className="text-[11px] font-semibold text-violet-950">
          Per-person prices: {props.selectedRowLabel}
        </p>
        {props.linkedHint ? (
          <p className="mt-0.5 text-[10px] text-violet-800">{props.linkedHint}</p>
        ) : null}
        <p className="mt-0.5 text-[10px] text-violet-700">
          Click names in the column headers, enter one fare, Apply — repeat for a different fare
          tier. Row total adds up automatically. Open the row for booking status.
        </p>
      </div>
      <span className="text-[10px] font-medium text-violet-800">
        {props.selectedParticipantCount} selected · {props.eligibleParticipantCount} on this leg
      </span>
      <div className="ml-auto flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={props.onSelectAll}
          className="rounded border border-violet-300 bg-white px-2 py-0.5 text-[10px] font-medium text-violet-900 hover:bg-violet-50"
        >
          All on this leg
        </button>
        <button
          type="button"
          onClick={props.onClearSelection}
          className="rounded border border-violet-300 bg-white px-2 py-0.5 text-[10px] font-medium text-violet-900 hover:bg-violet-50"
        >
          Clear selection
        </button>
        <input
          type="text"
          inputMode="decimal"
          value={amountInput}
          onChange={(e) => setAmountInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              apply();
            }
          }}
          placeholder="Amount each"
          className="w-28 rounded border border-violet-400 bg-white px-2 py-0.5 text-[11px] tabular-nums"
        />
        <button
          type="button"
          disabled={props.selectedParticipantCount === 0 || !amountInput.trim()}
          onClick={apply}
          className="rounded border border-violet-700 bg-violet-700 px-2.5 py-0.5 text-[10px] font-semibold text-white hover:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Apply to selected
        </button>
        <button
          type="button"
          onClick={props.onDone}
          className="rounded border border-zinc-300 bg-white px-2.5 py-0.5 text-[10px] font-medium text-zinc-700 hover:bg-zinc-50"
        >
          Done
        </button>
      </div>
    </div>
  );
}
