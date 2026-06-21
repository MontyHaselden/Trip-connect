"use client";

import type { CostLedgerProjection } from "@/lib/trip-engine/cost-ledger/types";
import { formatMoney } from "@/lib/trip-engine/cost-ledger/format-money";
import type { RosterSummary } from "@/lib/trip-engine/types";

import type { TripOsSection } from "../TripOsWorkspace";

export function OverviewFinancePanel(props: {
  costLedger: CostLedgerProjection | null;
  roster: RosterSummary;
  onNavigateSection?: (section: TripOsSection) => void;
}) {
  const ledger = props.costLedger;
  if (!ledger) return null;

  const settings = ledger.settings;
  const participants = props.roster.participants.filter((p) => p.inCostSplit);
  if (participants.length === 0 && ledger.lineItems.length === 0) return null;

  const lineCount = ledger.lineItems.filter((l) => l.totalAmountCents > 0).length;

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
            Trip finances
          </h3>
          <p className="mt-1 text-sm text-zinc-600">
            {lineCount} expense line{lineCount === 1 ? "" : "s"} · {participants.length} in cost
            split
          </p>
        </div>
        {props.onNavigateSection ? (
          <button
            type="button"
            onClick={() => props.onNavigateSection!("finance")}
            className="shrink-0 rounded-full bg-violet-600 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-violet-700"
          >
            Open finance sheet →
          </button>
        ) : null}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-4">
        <FinanceStat label="Trip gross" value={formatMoney(ledger.tripGrossCents, settings.baseCurrency)} />
        <FinanceStat
          label="Fund credits"
          value={formatMoney(ledger.tripFundCreditsCents, settings.baseCurrency)}
        />
        <FinanceStat label="Collected" value={formatMoney(ledger.tripPaidCents, settings.baseCurrency)} />
        <FinanceStat
          label="Outstanding"
          value={formatMoney(ledger.tripOutstandingCents, settings.baseCurrency)}
          highlight
        />
      </div>

      {participants.length > 0 ? (
        <div className="mt-4 overflow-x-auto rounded-lg border border-zinc-200">
          <table className="min-w-full text-left text-xs">
            <thead className="bg-zinc-50 text-zinc-500">
              <tr>
                <th className="px-3 py-2 font-medium">Person</th>
                <th className="px-3 py-2 font-medium">Gross</th>
                <th className="px-3 py-2 font-medium">− Funds</th>
                <th className="px-3 py-2 font-medium">− Paid</th>
                <th className="px-3 py-2 font-semibold">Balance</th>
              </tr>
            </thead>
            <tbody>
              {participants.map((p) => {
                const bal = ledger.personBalances.find((b) => b.participantId === p.id);
                const owed = (bal?.balanceCents ?? 0) > 0;
                return (
                  <tr key={p.id} className="border-t border-zinc-100">
                    <td className="px-3 py-2 font-medium text-zinc-800">{p.fullName}</td>
                    <td className="px-3 py-2 tabular-nums">{formatMoney(bal?.grossCents ?? 0)}</td>
                    <td className="px-3 py-2 tabular-nums">
                      {formatMoney(bal?.fundCreditsCents ?? 0)}
                    </td>
                    <td className="px-3 py-2 tabular-nums">{formatMoney(bal?.paidCents ?? 0)}</td>
                    <td
                      className={[
                        "px-3 py-2 font-semibold tabular-nums",
                        owed ? "text-amber-700" : "text-emerald-700",
                      ].join(" ")}
                    >
                      {formatMoney(bal?.balanceCents ?? 0)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}

function FinanceStat(props: { label: string; value: string; highlight?: boolean }) {
  return (
    <div
      className={[
        "rounded-xl px-3 py-2.5",
        props.highlight ? "bg-violet-600 text-white" : "bg-zinc-50",
      ].join(" ")}
    >
      <p className={props.highlight ? "text-[10px] text-violet-200" : "text-[10px] text-zinc-500"}>
        {props.label}
      </p>
      <p
        className={[
          "mt-0.5 text-base font-semibold tabular-nums",
          props.highlight ? "" : "text-zinc-900",
        ].join(" ")}
      >
        {props.value}
      </p>
    </div>
  );
}
