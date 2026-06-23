"use client";

import {
  compactStatusSummary,
  COST_STATUS_LABELS,
  FUNDING_STATUS_LABELS,
  LINE_PAYMENT_STATUS_LABELS,
} from "@/lib/trip-engine/cost-ledger/finance-metadata";
import type { CostLineItemDraft } from "@/lib/trip-engine/cost-ledger/types";

const CHIP_CLASS: Record<string, string> = {
  cost: "bg-sky-50 text-sky-800 border-sky-200",
  payment: "bg-violet-50 text-violet-800 border-violet-200",
  funding: "bg-amber-50 text-amber-900 border-amber-200",
};

function Chip(props: { label: string; tone: keyof typeof CHIP_CLASS }) {
  return (
    <span
      className={[
        "inline-flex rounded border px-1 py-0.5 text-[9px] font-medium leading-none",
        CHIP_CLASS[props.tone],
      ].join(" ")}
    >
      {props.label}
    </span>
  );
}

export function FinanceStatusChips(props: { line: CostLineItemDraft; compact?: boolean }) {
  const { line, compact } = props;
  if (compact) {
    const summary = compactStatusSummary(
      line.costStatus,
      line.linePaymentStatus,
      line.fundingStatus,
    );
    if (
      line.costStatus === "unknown" &&
      line.linePaymentStatus === "unpaid" &&
      line.fundingStatus === "unfunded"
    ) {
      return null;
    }
    return (
      <p className="mt-0.5 text-[9px] text-zinc-500" title={summary}>
        {summary}
      </p>
    );
  }

  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {line.costStatus !== "unknown" ? (
        <Chip label={COST_STATUS_LABELS[line.costStatus]} tone="cost" />
      ) : null}
      {line.linePaymentStatus !== "unpaid" ? (
        <Chip label={LINE_PAYMENT_STATUS_LABELS[line.linePaymentStatus]} tone="payment" />
      ) : null}
      {line.fundingStatus !== "unfunded" ? (
        <Chip label={FUNDING_STATUS_LABELS[line.fundingStatus]} tone="funding" />
      ) : null}
    </div>
  );
}
