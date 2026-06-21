"use client";

import { Fragment, useMemo, useState } from "react";

import type {
  CostLedgerProjection,
  CostLineItemDraft,
} from "@/lib/trip-engine/cost-ledger/types";
import {
  COST_CATEGORIES,
  COST_CATEGORY_LABELS,
  type CostLineCategory,
} from "@/lib/trip-engine/cost-ledger/types";
import {
  allocationRuleLabel,
  buildGroupColumns,
  formatLineTotal,
  participantHeaderLabel,
  sumAllocationsForParticipants,
  type GroupColumn,
} from "@/lib/trip-engine/cost-ledger/display-utils";
import { formatMoney, convertToBaseCents } from "@/lib/trip-engine/cost-ledger/format-money";
import type { RosterSummary } from "@/lib/trip-engine/types";

type GridView = "total" | "group" | "person";

type DataColumn =
  | { kind: "participant"; participant: RosterSummary["participants"][number] }
  | { kind: "group"; group: GroupColumn };

function buildDataColumns(
  roster: RosterSummary,
  view: GridView,
  selectedPersonId: string | null,
): DataColumn[] {
  const pool = roster.participants.filter((p) => p.inCostSplit && p.role !== "host");
  if (view === "person" && selectedPersonId) {
    const person = pool.find((p) => p.id === selectedPersonId);
    return person ? [{ kind: "participant", participant: person }] : [];
  }
  if (view === "group") {
    return buildGroupColumns(roster).map((group) => ({ kind: "group", group }));
  }
  return pool.map((participant) => ({ kind: "participant", participant }));
}

function columnHeader(col: DataColumn, pool: RosterSummary["participants"]): string {
  if (col.kind === "group") return col.group.label;
  return participantHeaderLabel(col.participant, pool);
}

function columnLetter(index: number): string {
  let n = index;
  let label = "";
  while (n >= 0) {
    label = String.fromCharCode(65 + (n % 26)) + label;
    n = Math.floor(n / 26) - 1;
  }
  return label;
}

function cellAmount(
  col: DataColumn,
  alloc: Record<string, number>,
  lineCurrency: string,
  settings: CostLedgerProjection["settings"],
): number | null {
  if (col.kind === "participant") {
    const cents = alloc[col.participant.id];
    if (cents == null) return null;
    return convertToBaseCents(cents, lineCurrency, settings);
  }
  const total = sumAllocationsForParticipants(
    alloc,
    col.group.participantIds,
    lineCurrency,
    settings,
  );
  return total > 0 ? total : null;
}

const thClass =
  "border border-zinc-300 bg-zinc-100 px-2 py-1.5 text-[11px] font-semibold text-zinc-700";
const tdClass = "border border-zinc-300 px-2 py-1 text-[11px] text-zinc-800 tabular-nums";
const tdTextClass = "border border-zinc-300 px-2 py-1 text-[11px] text-zinc-800";

export function FinanceSpreadsheet(props: {
  costLedger: CostLedgerProjection;
  roster: RosterSummary;
  showEmptyLines: boolean;
  onEditLine: (line: CostLineItemDraft) => void;
}) {
  const [view, setView] = useState<GridView>("total");
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);

  const pool = useMemo(
    () => props.roster.participants.filter((p) => p.inCostSplit && p.role !== "host"),
    [props.roster.participants],
  );

  const columns = useMemo(
    () => buildDataColumns(props.roster, view, selectedPersonId),
    [props.roster, view, selectedPersonId],
  );

  const allocationByLine = useMemo(() => {
    const map = new Map<string, Record<string, number>>();
    for (const row of props.costLedger.lineAllocations) {
      map.set(row.lineItemId, row.allocations);
    }
    return map;
  }, [props.costLedger.lineAllocations]);

  const visibleLines = useMemo(() => {
    if (props.showEmptyLines) return props.costLedger.lineItems;
    return props.costLedger.lineItems.filter((l) => l.totalAmountCents > 0);
  }, [props.costLedger.lineItems, props.showEmptyLines]);

  const emptyCount = props.costLedger.lineItems.filter((l) => l.totalAmountCents === 0).length;

  const linesByCategory = useMemo(() => {
    const grouped = new Map<CostLineCategory, CostLineItemDraft[]>();
    for (const cat of COST_CATEGORIES) grouped.set(cat, []);
    for (const line of visibleLines) {
      grouped.get(line.category)?.push(line);
    }
    return grouped;
  }, [visibleLines]);

  const settings = props.costLedger.settings;
  let rowNumber = 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-zinc-200 bg-zinc-50 px-3 py-2">
        {(["total", "group", "person"] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => setView(mode)}
            className={[
              "rounded px-2.5 py-1 text-[11px] font-medium transition",
              view === mode
                ? "bg-white text-zinc-900 shadow-sm ring-1 ring-zinc-300"
                : "text-zinc-600 hover:bg-white/70",
            ].join(" ")}
          >
            {mode === "total" ? "By person" : mode === "group" ? "By group" : "One person"}
          </button>
        ))}
        {view === "person" ? (
          <select
            value={selectedPersonId ?? ""}
            onChange={(e) => setSelectedPersonId(e.target.value || null)}
            className="rounded border border-zinc-300 bg-white px-2 py-1 text-[11px]"
          >
            <option value="">Select person…</option>
            {pool.map((p) => (
              <option key={p.id} value={p.id}>
                {p.fullName}
              </option>
            ))}
          </select>
        ) : null}
        {!props.showEmptyLines && emptyCount > 0 ? (
          <span className="text-[11px] text-zinc-500">{emptyCount} empty rows hidden</span>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-auto bg-zinc-200/50 p-2">
        <table className="w-max min-w-full border-collapse bg-white text-left shadow-sm">
          <thead className="sticky top-0 z-20">
            <tr>
              <th className={`${thClass} sticky left-0 z-30 w-10 bg-zinc-200 text-center`} />
              <th className={`${thClass} sticky left-10 z-30 min-w-[14rem] bg-zinc-200`}>
                Description
              </th>
              <th className={`${thClass} w-12 bg-zinc-200 text-center`}>Qty</th>
              <th className={`${thClass} min-w-[6rem] bg-zinc-200`}>Total</th>
              <th className={`${thClass} min-w-[5rem] bg-zinc-200`}>Rule</th>
              {columns.map((col, i) => (
                <th
                  key={col.kind === "group" ? col.group.id : col.participant.id}
                  className={`${thClass} min-w-[4.5rem] bg-zinc-200 text-center`}
                  title={
                    col.kind === "participant" ? col.participant.fullName : col.group.label
                  }
                >
                  <span className="block text-[9px] font-normal text-zinc-500">
                    {columnLetter(i)}
                  </span>
                  <span className="block truncate">{columnHeader(col, pool)}</span>
                </th>
              ))}
              <th className={`${thClass} w-10 bg-zinc-200 text-center`}>✓</th>
            </tr>
          </thead>
          <tbody>
            {visibleLines.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + 6}
                  className="border border-zinc-300 px-4 py-8 text-center text-[11px] text-zinc-500"
                >
                  {columns.length === 0
                    ? "No participants in cost split — check Users."
                    : emptyCount > 0 && !props.showEmptyLines
                      ? "Linked trip rows are hidden — click Show empty, or use + Row."
                      : "No expense rows yet — add stays/transport in Trip OS, or use + Row."}
                </td>
              </tr>
            ) : (
              COST_CATEGORIES.map((category) => {
                const lines = linesByCategory.get(category) ?? [];
                if (!lines.length) return null;

                let categorySubtotal = 0;
                for (const line of lines) {
                  categorySubtotal += convertToBaseCents(
                    line.totalAmountCents,
                    line.currency,
                    settings,
                  );
                }

                return (
                  <Fragment key={category}>
                    <tr className="bg-zinc-50">
                      <td
                        colSpan={columns.length + 6}
                        className="border border-zinc-300 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-zinc-600"
                      >
                        {COST_CATEGORY_LABELS[category]}
                      </td>
                    </tr>
                    {lines.map((line) => {
                      rowNumber += 1;
                      const alloc = allocationByLine.get(line.id) ?? {};
                      const lineResult = props.costLedger.lineAllocations.find(
                        (l) => l.lineItemId === line.id,
                      );
                      const totalDisplay = formatLineTotal(line, settings);
                      const isEmpty = line.totalAmountCents === 0;

                      return (
                        <tr
                          key={line.id}
                          onClick={() => props.onEditLine(line)}
                          className={[
                            "cursor-pointer hover:bg-sky-50/80",
                            isEmpty ? "text-zinc-400" : "",
                          ].join(" ")}
                        >
                          <td
                            className={`${tdClass} sticky left-0 z-10 bg-inherit text-center text-zinc-400`}
                          >
                            {rowNumber}
                          </td>
                          <td
                            className={`${tdTextClass} sticky left-10 z-10 max-w-[18rem] bg-inherit font-medium`}
                          >
                            <span className="line-clamp-2" title={line.description}>
                              {line.description}
                            </span>
                          </td>
                          <td className={`${tdClass} text-center`}>{line.quantity ?? ""}</td>
                          <td className={tdClass}>
                            <div>{totalDisplay.primary}</div>
                            {totalDisplay.secondary ? (
                              <div className="text-[9px] text-zinc-500">{totalDisplay.secondary}</div>
                            ) : null}
                          </td>
                          <td className={`${tdTextClass} max-w-[6rem] text-zinc-600`}>
                            {allocationRuleLabel(
                              line.allocationRuleType,
                              line.allocationRulePayload,
                              props.roster,
                            )}
                          </td>
                          {columns.map((col) => {
                            const amount = cellAmount(col, alloc, line.currency, settings);
                            return (
                              <td
                                key={col.kind === "group" ? col.group.id : col.participant.id}
                                className={`${tdClass} text-right`}
                              >
                                {amount != null
                                  ? formatMoney(amount, settings.baseCurrency)
                                  : ""}
                              </td>
                            );
                          })}
                          <td className={`${tdClass} text-center`}>
                            {line.totalAmountCents === 0 ? (
                              ""
                            ) : lineResult?.balanced ? (
                              <span className="text-emerald-600">✓</span>
                            ) : (
                              <span className="font-bold text-amber-600">!</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    <tr className="bg-zinc-50 font-semibold">
                      <td className={`${tdClass} sticky left-0 z-10 bg-zinc-50`} />
                      <td className={`${tdTextClass} sticky left-10 z-10 bg-zinc-50`}>Subtotal</td>
                      <td className={tdClass} />
                      <td className={tdClass}>
                        {formatMoney(categorySubtotal, settings.baseCurrency)}
                      </td>
                      <td colSpan={columns.length + 2} className={tdClass} />
                    </tr>
                  </Fragment>
                );
              })
            )}
            {columns.length > 0 ? (
              <tr className="bg-violet-50 font-bold">
                <td className={`${tdClass} sticky left-0 z-10 bg-violet-50`} />
                <td className={`${tdTextClass} sticky left-10 z-10 bg-violet-50`}>
                  Gross per person
                </td>
                <td className={`${tdClass} bg-violet-50`} />
                <td className={`${tdClass} bg-violet-50`}>
                  {formatMoney(props.costLedger.tripGrossCents, settings.baseCurrency)}
                </td>
                <td className={`${tdClass} bg-violet-50`} />
                {columns.map((col) => {
                  let gross = 0;
                  if (col.kind === "participant") {
                    gross =
                      props.costLedger.personBalances.find(
                        (b) => b.participantId === col.participant.id,
                      )?.grossCents ?? 0;
                  } else {
                    for (const id of col.group.participantIds) {
                      gross +=
                        props.costLedger.personBalances.find((b) => b.participantId === id)
                          ?.grossCents ?? 0;
                    }
                  }
                  return (
                    <td
                      key={col.kind === "group" ? col.group.id : col.participant.id}
                      className={`${tdClass} bg-violet-50 text-right`}
                    >
                      {formatMoney(gross, settings.baseCurrency)}
                    </td>
                  );
                })}
                <td className={`${tdClass} bg-violet-50`} />
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
