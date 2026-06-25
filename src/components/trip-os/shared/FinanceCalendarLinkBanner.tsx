"use client";

import {
  financeSectionAllocationMessage,
  type FinanceSectionAllocationStatus,
} from "@/lib/trip-engine/cost-ledger/finance-section-readiness";
import {
  financeSectionLabel,
  type FinanceBuiltInSection,
} from "@/lib/trip-engine/cost-ledger/finance-sections";

const CALENDAR_HINT: Record<FinanceBuiltInSection, string> = {
  accommodation:
    "Add the stay on the trip calendar (select days → Accommodation). Finance will follow automatically.",
  transport:
    "Add the leg on the trip calendar (select travel days → Transport). Finance will follow automatically.",
  activities:
    "Add the activity on the trip calendar (select a day → Activities). Finance will follow automatically.",
};

export function FinanceCalendarLinkBanner(props: {
  section: FinanceBuiltInSection;
  status: FinanceSectionAllocationStatus | null;
  onOpenFinance: () => void;
}) {
  const { status } = props;
  if (!status || status.unallocatedCount === 0) return null;

  const sectionLabel = financeSectionLabel(props.section).toLowerCase();
  const financeOnly = status.financeOnlyCount > 0;

  return (
    <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-950">
      <p className="font-semibold">
        {financeOnly
          ? `You added ${status.financeOnlyCount} ${sectionLabel} cost${
              status.financeOnlyCount === 1 ? "" : "s"
            } in Finance that ${status.financeOnlyCount === 1 ? "isn't" : "aren't"} on the calendar yet`
          : `${status.unallocatedCount} ${sectionLabel} cost${
              status.unallocatedCount === 1 ? "" : "s"
            } in Finance still need prices or per-person splits`}
      </p>
      <p className="mt-1 text-red-900">{financeSectionAllocationMessage(status)}</p>
      {financeOnly ? (
        <p className="mt-2 text-xs leading-relaxed text-red-800">{CALENDAR_HINT[props.section]}</p>
      ) : null}
      <button
        type="button"
        onClick={props.onOpenFinance}
        className="mt-3 text-sm font-medium text-red-800 underline decoration-red-300 underline-offset-2 hover:text-red-950"
      >
        Open Finance → {financeSectionLabel(props.section)}
      </button>
    </div>
  );
}
