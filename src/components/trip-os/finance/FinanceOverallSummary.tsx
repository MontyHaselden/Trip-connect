"use client";

import { formatMoney } from "@/lib/trip-engine/cost-ledger/format-money";
import { computeFinanceTripSummary } from "@/lib/trip-engine/cost-ledger/finance-summary";
import type { CostLedgerProjection } from "@/lib/trip-engine/cost-ledger/types";

export function FinanceOverallSummary(props: { ledger: CostLedgerProjection }) {
  const s = computeFinanceTripSummary(props.ledger);
  const currency = props.ledger.settings.baseCurrency;

  const items = [
    { label: "Total trip cost", value: formatMoney(s.totalTripCostCents, currency) },
    { label: "Funded", value: formatMoney(s.totalFundedCents, currency) },
    { label: "Paid out", value: formatMoney(s.totalPaidOutCents, currency) },
    {
      label: "Outstanding to suppliers",
      value: formatMoney(s.outstandingToSuppliersCents, currency),
    },
    { label: "Still to fund", value: formatMoney(s.stillToFundCents, currency) },
    {
      label: "Participant balances owing",
      value: formatMoney(props.ledger.tripOutstandingCents, currency),
    },
    { label: "Reimbursements needed", value: formatMoney(s.reimbursableCents, currency) },
    { label: "Missing costs", value: String(s.unknownCostCount) },
    { label: "Missing invoices", value: String(s.missingInvoiceCount) },
    { label: "Missing receipts", value: String(s.missingReceiptCount) },
  ];

  return (
    <div className="mb-3 grid grid-cols-2 gap-2 rounded-lg border border-zinc-200 bg-zinc-50/80 p-3 sm:grid-cols-3 lg:grid-cols-5">
      {items.map((item) => (
        <div key={item.label} className="min-w-0">
          <p className="truncate text-[9px] font-medium uppercase tracking-wide text-zinc-500">
            {item.label}
          </p>
          <p className="text-xs font-semibold tabular-nums text-zinc-900">{item.value}</p>
        </div>
      ))}
    </div>
  );
}
