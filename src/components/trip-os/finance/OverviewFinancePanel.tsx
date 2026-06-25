"use client";

import { useMemo } from "react";

import { participantHeaderLabel } from "@/lib/trip-engine/cost-ledger/display-utils";
import {
  financeSectionLabel,
  financeSectionList,
  groupLinesByFinanceSection,
} from "@/lib/trip-engine/cost-ledger/finance-sections";
import { convertToBaseCents, formatMoney } from "@/lib/trip-engine/cost-ledger/format-money";
import type { CostLedgerProjection } from "@/lib/trip-engine/cost-ledger/types";
import type { RosterSummary, TripEntityGraph } from "@/lib/trip-engine/types";

import type { TripOsSection } from "../TripOsWorkspace";

const SECTION_ACCENT: Record<string, string> = {
  accommodation: "bg-sky-50 text-sky-800 ring-sky-100",
  transport: "bg-violet-50 text-violet-800 ring-violet-100",
  activities: "bg-amber-50 text-amber-900 ring-amber-100",
};

export function OverviewFinancePanel(props: {
  costLedger: CostLedgerProjection | null;
  roster: RosterSummary;
  graph?: TripEntityGraph | null;
  onNavigateSection?: (section: TripOsSection) => void;
}) {
  const ledger = props.costLedger;
  const settings = ledger?.settings;
  const participants = useMemo(
    () => props.roster.participants.filter((p) => p.inCostSplit),
    [props.roster.participants],
  );

  const sectionBreakdown = useMemo(() => {
    if (!ledger || !settings) return [];
    const lines = ledger.lineItems.filter((l) => l.totalAmountCents > 0);
    const bySection = groupLinesByFinanceSection(lines, props.graph, settings);
    return financeSectionList(settings)
      .map((section) => {
        const sectionLines = bySection.get(section) ?? [];
        const cents = sectionLines.reduce(
          (sum, line) =>
            sum + convertToBaseCents(line.totalAmountCents, line.currency, settings),
          0,
        );
        return {
          section,
          label: financeSectionLabel(section, settings),
          cents,
        };
      })
      .filter((row) => row.cents > 0);
  }, [ledger, props.graph, settings]);

  const balances = useMemo(() => {
    if (!ledger) return [];
    return participants
      .map((participant) => {
        const bal = ledger.personBalances.find((b) => b.participantId === participant.id);
        return {
          participant,
          label: participantHeaderLabel(participant, participants),
          balanceCents: bal?.balanceCents ?? 0,
        };
      })
      .sort((a, b) => b.balanceCents - a.balanceCents);
  }, [ledger, participants]);

  if (!ledger || !settings) return null;
  if (participants.length === 0 && ledger.lineItems.length === 0) return null;

  const currency = settings.baseCurrency;
  const lineCount = ledger.lineItems.filter((l) => l.totalAmountCents > 0).length;
  const gross = ledger.tripGrossCents;
  const collected = ledger.tripFundCreditsCents + ledger.tripPaidCents;
  const outstanding = ledger.tripOutstandingCents;
  const collectedPct = gross > 0 ? Math.min(100, Math.round((collected / gross) * 100)) : 0;
  const owingCount = balances.filter((row) => row.balanceCents > 0).length;
  const settledCount = balances.length - owingCount;

  return (
    <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
      <div className="flex items-start justify-between gap-4 border-b border-zinc-100 px-5 py-4">
        <div>
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
            Trip finances
          </h3>
          <p className="mt-1 text-sm text-zinc-500">
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

      <div className="px-5 py-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
              Trip total
            </p>
            <p className="mt-1 text-3xl font-semibold tabular-nums tracking-tight text-zinc-900">
              {formatMoney(gross, currency)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
              Still to collect
            </p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-amber-700">
              {formatMoney(outstanding, currency)}
            </p>
          </div>
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between text-[11px] text-zinc-500">
            <span>{formatMoney(collected, currency)} collected</span>
            <span>{collectedPct}%</span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-zinc-100">
            <div
              className="h-full rounded-full bg-violet-500 transition-all"
              style={{ width: `${collectedPct}%` }}
            />
          </div>
        </div>

        {sectionBreakdown.length > 0 ? (
          <div className="mt-5 flex flex-wrap gap-2">
            {sectionBreakdown.map((row) => (
              <div
                key={row.section}
                className={[
                  "rounded-xl px-3 py-2 ring-1",
                  SECTION_ACCENT[row.section] ?? "bg-zinc-50 text-zinc-800 ring-zinc-100",
                ].join(" ")}
              >
                <p className="text-[10px] font-semibold uppercase tracking-wide opacity-70">
                  {row.label}
                </p>
                <p className="mt-0.5 text-sm font-semibold tabular-nums">
                  {formatMoney(row.cents, currency)}
                </p>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      {balances.length > 0 ? (
        <div className="border-t border-zinc-100 bg-zinc-50/50 px-5 py-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-semibold text-zinc-700">Balances</p>
            <p className="text-[11px] text-zinc-500">
              {owingCount > 0 ? `${owingCount} still owe` : `${settledCount} settled up`}
            </p>
          </div>
          <ul className="mt-3 max-h-56 space-y-1 overflow-y-auto">
            {balances.map((row) => {
              const owes = row.balanceCents > 0;
              return (
                <li
                  key={row.participant.id}
                  className="flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2 ring-1 ring-zinc-100"
                >
                  <span
                    className="min-w-0 truncate text-sm font-medium text-zinc-800"
                    title={row.participant.fullName}
                  >
                    {row.label}
                  </span>
                  <span
                    className={[
                      "shrink-0 text-sm font-semibold tabular-nums",
                      owes ? "text-amber-700" : "text-emerald-700",
                    ].join(" ")}
                  >
                    {formatMoney(row.balanceCents, currency)}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
