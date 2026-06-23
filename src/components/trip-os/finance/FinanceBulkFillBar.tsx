"use client";

import { useState } from "react";

import { parseMoneyInput } from "@/lib/trip-engine/cost-ledger/format-money";

export function FinanceBulkFillBar(props: {
  selectedRowLabel: string;
  selectedParticipantCount: number;
  totalParticipantCount: number;
  currency: string;
  onApply: (amountCents: number) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
}) {
  const [amountInput, setAmountInput] = useState("");

  function apply() {
    const cents = parseMoneyInput(amountInput.trim(), props.currency);
    if (cents <= 0) return;
    props.onApply(cents);
    setAmountInput("");
  }

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-violet-200 bg-violet-50/90 px-3 py-2">
      <p className="text-[10px] font-medium text-violet-900">
        Fill row: <span className="font-semibold">{props.selectedRowLabel}</span>
      </p>
      <span className="text-[10px] text-violet-700">
        {props.selectedParticipantCount} of {props.totalParticipantCount} people selected
      </span>
      <div className="ml-auto flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={props.onSelectAll}
          className="rounded border border-violet-200 bg-white px-2 py-0.5 text-[10px] font-medium text-violet-800 hover:bg-violet-100"
        >
          Select all people
        </button>
        <button
          type="button"
          onClick={props.onClearSelection}
          className="rounded border border-violet-200 bg-white px-2 py-0.5 text-[10px] font-medium text-violet-800 hover:bg-violet-100"
        >
          Clear people
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
          className="w-24 rounded border border-violet-300 bg-white px-2 py-0.5 text-[11px] tabular-nums"
        />
        <button
          type="button"
          disabled={props.selectedParticipantCount === 0 || !amountInput.trim()}
          onClick={apply}
          className="rounded border border-violet-600 bg-violet-600 px-2.5 py-0.5 text-[10px] font-semibold text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Apply to selected
        </button>
      </div>
    </div>
  );
}
