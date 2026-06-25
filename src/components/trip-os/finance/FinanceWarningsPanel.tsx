"use client";

import { computeFinanceWarnings } from "@/lib/trip-engine/cost-ledger/finance-summary";
import type { CostLedgerProjection } from "@/lib/trip-engine/cost-ledger/types";

export function FinanceWarningsPanel(props: {
  ledger: CostLedgerProjection;
  onSelectLine?: (lineId: string) => void;
}) {
  const warnings = computeFinanceWarnings(props.ledger);
  if (!warnings.length) return null;

  return (
    <ul className="mb-2 space-y-1">
      {warnings.map((w) => (
        <li key={w.id}>
          <button
            type="button"
            disabled={!w.lineId || !props.onSelectLine}
            onClick={() => w.lineId && props.onSelectLine?.(w.lineId)}
            className={[
              "w-full rounded border px-2 py-1 text-left text-[10px]",
              w.severity === "warn"
                ? "border-amber-200 bg-amber-50 text-amber-900"
                : "border-zinc-200 bg-white text-zinc-700",
              w.lineId && props.onSelectLine ? "hover:bg-zinc-50" : "",
            ].join(" ")}
          >
            {w.message}
          </button>
        </li>
      ))}
    </ul>
  );
}
