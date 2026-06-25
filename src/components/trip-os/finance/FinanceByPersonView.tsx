"use client";

import { useMemo } from "react";

import {
  buildAllocationByLine,
  lineAllocationResult,
  lineIsVisibleInFinanceBreakdown,
  participantAllocationCentsWithPending,
  type PendingAllocationRows,
} from "@/lib/trip-engine/cost-ledger/finance-participant-display";
import {
  financeSectionLabel,
  financeSectionList,
  groupLinesByFinanceSection,
} from "@/lib/trip-engine/cost-ledger/finance-sections";
import { formatMoney } from "@/lib/trip-engine/cost-ledger/format-money";
import type { CostLedgerProjection } from "@/lib/trip-engine/cost-ledger/types";
import type { RosterSummary, TripEntityGraph } from "@/lib/trip-engine/types";

export function FinanceByPersonView(props: {
  costLedger: CostLedgerProjection;
  roster: RosterSummary;
  graph?: TripEntityGraph | null;
  participantId: string | null;
  onSelectParticipant: (participantId: string) => void;
  pendingAllocations?: PendingAllocationRows;
}) {
  const settings = props.costLedger.settings;
  const pendingAllocations = props.pendingAllocations ?? {};
  const pool = useMemo(
    () => props.roster.participants.filter((p) => p.inCostSplit && p.role !== "host"),
    [props.roster.participants],
  );

  const allocationByLine = useMemo(
    () => buildAllocationByLine(props.costLedger.lineAllocations),
    [props.costLedger.lineAllocations],
  );

  const linesBySection = useMemo(
    () => groupLinesByFinanceSection(props.costLedger.lineItems, props.graph, settings),
    [props.costLedger.lineItems, props.graph, settings],
  );

  const sections = financeSectionList(settings);
  const participantId = props.participantId ?? pool[0]?.id ?? null;
  const participant = pool.find((p) => p.id === participantId);

  const rows = useMemo(() => {
    if (!participantId) return [];
    const out: { section: string; description: string; amountCents: number }[] = [];
    for (const section of sections) {
      const lines = linesBySection.get(section) ?? [];
      for (const line of lines) {
        const lineAlloc = lineAllocationResult(props.costLedger, line.id);
        const pendingRow = pendingAllocations[line.id];
        if (!lineIsVisibleInFinanceBreakdown(line, lineAlloc, pendingRow)) continue;
        const amount = participantAllocationCentsWithPending(
          line,
          participantId,
          allocationByLine,
          settings,
          pendingRow,
        );
        if (amount <= 0) continue;
        out.push({
          section: financeSectionLabel(section, settings),
          description: line.description,
          amountCents: amount,
        });
      }
    }
    return out;
  }, [
    participantId,
    sections,
    linesBySection,
    allocationByLine,
    settings,
    pendingAllocations,
    props.costLedger,
  ]);

  const total = rows.reduce((sum, row) => sum + row.amountCents, 0);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 p-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="block text-[11px]">
          <span className="font-medium text-zinc-700">Person</span>
          <select
            value={participantId ?? ""}
            onChange={(e) => props.onSelectParticipant(e.target.value)}
            className="mt-1 block min-w-[12rem] rounded-lg border border-zinc-300 bg-white px-2.5 py-2 text-sm text-zinc-900"
          >
            {pool.map((p) => (
              <option key={p.id} value={p.id}>
                {p.fullName}
              </option>
            ))}
          </select>
        </label>
        {participant ? (
          <p className="text-sm text-zinc-600">
            Full trip breakdown for{" "}
            <span className="font-semibold text-zinc-900">{participant.fullName}</span>
          </p>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-zinc-200 bg-white">
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="bg-zinc-100 text-zinc-700">
              <th className="border-b border-zinc-200 px-3 py-2 font-semibold">Section</th>
              <th className="border-b border-zinc-200 px-3 py-2 font-semibold">Line</th>
              <th className="border-b border-zinc-200 px-3 py-2 text-right font-semibold">
                Amount
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-3 py-8 text-center text-zinc-500">
                  No allocated costs for this person yet.
                </td>
              </tr>
            ) : (
              rows.map((row, index) => (
                <tr key={`${row.section}-${row.description}-${index}`} className="hover:bg-zinc-50">
                  <td className="border-b border-zinc-100 px-3 py-2 text-zinc-600">{row.section}</td>
                  <td className="border-b border-zinc-100 px-3 py-2 text-zinc-900">
                    {row.description}
                  </td>
                  <td className="border-b border-zinc-100 px-3 py-2 text-right tabular-nums text-zinc-900">
                    {formatMoney(row.amountCents, settings.baseCurrency)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {rows.length > 0 ? (
            <tfoot>
              <tr className="bg-violet-50 font-semibold text-zinc-900">
                <td className="px-3 py-2" colSpan={2}>
                  Total for {participant?.fullName ?? "person"}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {formatMoney(total, settings.baseCurrency)}
                </td>
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>
    </div>
  );
}
