"use client";

import type { EntityFinanceDisplayStatus } from "@/lib/trip-engine/cost-ledger/finance-section-readiness";

export function FinanceLineStatusBadge(props: {
  status: EntityFinanceDisplayStatus;
  onNeedsAttention?: () => void;
  variant?: "section" | "rail";
  actionLabel?: string;
  attentionReason?: string | null;
  completeTitle?: string;
}) {
  if (props.status === "none") return null;

  if (props.status === "complete") {
    const completeTitle = props.completeTitle ?? "Priced and allocated";
    return (
      <span
        className={[
          "flex shrink-0 items-center justify-center font-bold text-emerald-600",
          props.variant === "rail" ? "h-6 w-6 text-sm" : "h-7 w-7 text-base",
        ].join(" ")}
        aria-label={completeTitle}
        title={completeTitle}
      >
        ✓
      </span>
    );
  }

  const actionLabel = props.actionLabel ?? "Add finances";
  const hoverReason =
    props.attentionReason?.trim() ||
    "Needs prices or per-person splits in Finance";

  if (props.variant === "rail") {
    return (
      <button
        type="button"
        onClick={props.onNeedsAttention}
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded border border-red-300 bg-red-50 text-xs font-bold text-red-700 hover:bg-red-100"
        title={hoverReason}
        aria-label={hoverReason}
      >
        !
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={props.onNeedsAttention}
      className="flex shrink-0 flex-col items-center gap-0.5 rounded-xl border border-red-200 bg-red-50 px-2.5 py-1.5 text-center hover:bg-red-100"
      title={hoverReason}
      aria-label={`${actionLabel} — ${hoverReason}`}
    >
      <span className="flex h-5 w-5 items-center justify-center rounded bg-red-500/15 text-xs font-bold leading-none text-red-700">
        !
      </span>
      <span className="text-[11px] font-semibold leading-tight text-red-800">{actionLabel}</span>
    </button>
  );
}
