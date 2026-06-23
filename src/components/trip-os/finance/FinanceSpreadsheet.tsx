"use client";

import { Fragment, useMemo, useState } from "react";

import type { CostLedgerProjection } from "@/lib/trip-engine/cost-ledger/types";
import {
  buildParticipantPresenceMap,
  lineDateSpanLabel,
  presenceHintForLine,
} from "@/lib/trip-engine/cost-ledger/presence";
import {
  absenceMessageForParticipant,
  FINANCE_ENTITY_SECTIONS,
  FINANCE_SECTION_DESCRIPTIONS,
  FINANCE_SECTION_LABELS,
  financeSectionForLine,
  groupLinesByFinanceSection,
  logisticsGrossForParticipant,
  sectionTotalForParticipant,
  type FinanceEntitySection,
} from "@/lib/trip-engine/cost-ledger/finance-sections";
import { eligibleParticipantIdsForLine } from "@/lib/trip-engine/cost-ledger/presence";
import type { TripEntityGraph } from "@/lib/trip-engine/types";
import {
  formatLineTotal,
  participantHeaderLabel,
} from "@/lib/trip-engine/cost-ledger/display-utils";
import { formatMoney, convertToBaseCents } from "@/lib/trip-engine/cost-ledger/format-money";
import {
  nightsLabel,
  participantNightsForLine,
  stayForLine,
} from "@/lib/trip-engine/cost-ledger/accommodation-nights";
import type { RosterSummary } from "@/lib/trip-engine/types";

import type { CostLineFormValues } from "../costs/CostLineDrawer";
import { FinanceDeleteModal } from "./FinanceDeleteModal";
import { FinanceStatusChips } from "./FinanceStatusChips";
import { FinanceOverallSummary } from "./FinanceOverallSummary";
import { FinanceWarningsPanel } from "./FinanceWarningsPanel";
import type { CostLineItemDraft } from "@/lib/trip-engine/cost-ledger/types";
import {
  FinanceAmountCell,
  FinanceDescriptionCell,
  FinanceParticipantAmountCell,
  FinanceQtyCell,
  type OpenCell,
} from "./FinanceCellEditors";
import { FinanceAbsentCell } from "./FinanceAbsentCell";
import { FinanceBulkFillBar } from "./FinanceBulkFillBar";
import { FinanceParticipantHeader } from "./FinanceParticipantHeader";

type FinanceTab = FinanceEntitySection | "overall";

const thClass =
  "border border-zinc-300 bg-zinc-200 px-2.5 py-2 text-xs font-semibold text-zinc-700 align-middle";
const thMoneyClass =
  "border border-zinc-300 bg-zinc-200 px-2 py-2 text-xs font-semibold text-zinc-700 align-middle whitespace-nowrap";
/** Min width only — columns grow to fit the widest amount in that column. */
const moneyColWidth = "min-w-[6.5rem]";
const participantColWidth = "min-w-[5.5rem]";
const tdClass =
  "border border-zinc-300 px-2.5 py-2 text-xs text-zinc-800 tabular-nums align-middle";
const tdMoneyClass = `${tdClass} ${moneyColWidth} whitespace-nowrap`;
const tdParticipantClass = `${tdClass} ${participantColWidth} whitespace-nowrap`;
const tdTextClass =
  "border border-zinc-300 px-3 py-2 text-xs text-zinc-800 align-middle";
const tdRowBg = "bg-white group-hover:bg-zinc-50";

/** Opaque sticky layers — no transparency so scrolled cells don't bleed through. */
const stickyHeadCorner =
  "sticky top-0 z-40 bg-zinc-200 shadow-[2px_2px_4px_-2px_rgba(0,0,0,0.12)]";
const stickyHeadTop = "sticky top-0 z-20 bg-zinc-200";
const stickyColLeft = "sticky left-0 z-10 bg-white shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)]";
const stickyColDesc = "sticky left-12 z-10 bg-white shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)]";

const TAB_ACCENT: Record<FinanceTab, string> = {
  accommodation: "border-sky-500 text-sky-800 bg-sky-50",
  transport: "border-violet-500 text-violet-800 bg-violet-50",
  activities: "border-amber-500 text-amber-900 bg-amber-50",
  overall: "border-zinc-500 text-zinc-800 bg-zinc-50",
};

const TAB_PANEL_CLASS: Record<FinanceEntitySection, string> = {
  accommodation: "bg-sky-50/80 border-sky-100",
  transport: "bg-violet-50/80 border-violet-100",
  activities: "bg-amber-50/80 border-amber-100",
};

export function FinanceSpreadsheet(props: {
  costLedger: CostLedgerProjection;
  roster: RosterSummary;
  graph?: TripEntityGraph | null;
  showEmptyLines: boolean;
  onPatchLine: (lineId: string, patch: Partial<CostLineFormValues>) => void;
  onPatchParticipant: (
    lineId: string,
    participantId: string,
    amountCents: number | null,
  ) => void;
  onPatchParticipantsBulk?: (
    lineId: string,
    participantIds: string[],
    amountCents: number,
  ) => void;
  onDismissLine?: (lineId: string) => Promise<void>;
  onDeleteLine?: (lineId: string) => Promise<void>;
  onRemoveLineFromTrip?: (lineId: string) => Promise<void>;
  onDeleteLines?: (
    lineIds: string[],
    mode: "financeOnly" | "removeFromTrip",
  ) => Promise<void>;
  onAddExtraLine?: (section: FinanceEntitySection) => void;
  onReorderSectionLines?: (section: FinanceEntitySection, orderedIds: string[]) => void;
  detailLineId?: string | null;
  onOpenLineDetail?: (lineId: string) => void;
}) {
  const [activeTab, setActiveTab] = useState<FinanceTab>("accommodation");
  const [openCell, setOpenCell] = useState<OpenCell>(null);
  const [selectedLineIds, setSelectedLineIds] = useState<Set<string>>(new Set());
  const [pendingDeleteLines, setPendingDeleteLines] = useState<CostLineItemDraft[] | null>(null);
  const [dragLineId, setDragLineId] = useState<string | null>(null);
  const [dragOverLineId, setDragOverLineId] = useState<string | null>(null);
  const [selectedParticipantIds, setSelectedParticipantIds] = useState<Set<string>>(new Set());
  const [fillRowId, setFillRowId] = useState<string | null>(null);

  const presence = useMemo(
    () =>
      props.graph ? buildParticipantPresenceMap(props.graph, props.roster) : undefined,
    [props.graph, props.roster],
  );

  const pool = useMemo(
    () => props.roster.participants.filter((p) => p.inCostSplit && p.role !== "host"),
    [props.roster.participants],
  );

  const allocationByLine = useMemo(() => {
    const map = new Map<string, Record<string, number>>();
    for (const row of props.costLedger.lineAllocations) {
      map.set(row.lineItemId, row.allocations);
    }
    return map;
  }, [props.costLedger.lineAllocations]);

  const visibleLines = useMemo(() => {
    const lines = props.costLedger.lineItems.filter(
      (line) => financeSectionForLine(line, props.graph) != null,
    );
    if (props.showEmptyLines) return lines;
    return lines.filter((l) => l.totalAmountCents > 0);
  }, [props.costLedger.lineItems, props.showEmptyLines, props.graph]);

  const emptyCount = props.costLedger.lineItems.filter((l) => l.totalAmountCents === 0).length;

  const linesBySection = useMemo(
    () => groupLinesByFinanceSection(visibleLines, props.graph),
    [visibleLines, props.graph],
  );

  const tabLines = useMemo(() => {
    if (activeTab === "overall") return [];
    return linesBySection.get(activeTab) ?? [];
  }, [activeTab, linesBySection]);

  const bulkFillLineId =
    fillRowId ??
    (activeTab !== "overall" && selectedLineIds.size === 1 ? [...selectedLineIds][0]! : null);
  const bulkFillLine = useMemo(() => {
    if (!bulkFillLineId) return null;
    return (
      tabLines.find((line) => line.id === bulkFillLineId) ??
      props.costLedger.lineItems.find((line) => line.id === bulkFillLineId) ??
      null
    );
  }, [bulkFillLineId, tabLines, props.costLedger.lineItems]);

  const selectableLineIds = useMemo(
    () => (activeTab === "overall" ? [] : tabLines.map((line) => line.id)),
    [activeTab, tabLines],
  );

  const allVisibleSelected =
    selectableLineIds.length > 0 &&
    selectableLineIds.every((id) => selectedLineIds.has(id));

  function toggleLineSelection(lineId: string) {
    setSelectedLineIds((prev) => {
      const next = new Set(prev);
      if (next.has(lineId)) next.delete(lineId);
      else next.add(lineId);
      return next;
    });
  }

  function startPerPersonFill(lineId: string) {
    setFillRowId(lineId);
    setSelectedParticipantIds(new Set());
  }

  function exitPerPersonFill() {
    setFillRowId(null);
    setSelectedParticipantIds(new Set());
  }

  function toggleParticipantSelection(participantId: string) {
    if (!bulkFillLineId) return;
    setSelectedParticipantIds((prev) => {
      const next = new Set(prev);
      if (next.has(participantId)) next.delete(participantId);
      else next.add(participantId);
      return next;
    });
  }

  function applyBulkFill(amountCents: number) {
    if (!bulkFillLine || !props.onPatchParticipantsBulk) return;
    const eligible = eligibleIdsForLine(bulkFillLine);
    const targets = [...selectedParticipantIds].filter((id) => eligible.includes(id));
    if (!targets.length) return;
    props.onPatchParticipantsBulk(bulkFillLine.id, targets, amountCents);
  }

  function eligibleIdsForLine(line: CostLineItemDraft): string[] {
    if (props.graph && presence) {
      return eligibleParticipantIdsForLine(line, props.graph, props.roster, presence);
    }
    return pool.map((p) => p.id);
  }

  function linkedLegHint(line: CostLineItemDraft): string | null {
    if (!props.graph) return null;
    if (line.linkedTransportLegId) {
      const leg = [
        ...props.graph.outboundLegs,
        ...props.graph.returnLegs,
        ...props.graph.intercityLegs,
      ].find((l) => l.id === line.linkedTransportLegId);
      if (!leg) return "Linked to trip transport leg";
      const from =
        ("intercityFromCity" in leg && leg.intercityFromCity) || leg.fromCity || "?";
      const to = ("intercityToCity" in leg && leg.intercityToCity) || leg.toCity || "?";
      return `From trip calendar · ${leg.travelDate ?? "—"} · ${from} → ${to}`;
    }
    if (line.linkedStayId) return "From trip calendar · accommodation stay";
    if (line.linkedActivityId) return "From trip calendar · activity";
    return null;
  }

  function toggleSelectAllVisible() {
    setSelectedLineIds((prev) => {
      if (allVisibleSelected) return new Set();
      return new Set(selectableLineIds);
    });
  }

  function openDeleteSelected() {
    const lines = tabLines.filter((line) => selectedLineIds.has(line.id));
    if (!lines.length) return;
    setPendingDeleteLines(lines);
  }

  async function confirmFinanceOnlyDelete(lines: CostLineItemDraft[]) {
    const lineIds = lines.map((line) => line.id);
    if (props.onDeleteLines) {
      await props.onDeleteLines(lineIds, "financeOnly");
    } else {
      for (const line of lines) {
        const linked = Boolean(
          line.linkedStayId || line.linkedTransportLegId || line.linkedActivityId,
        );
        if (linked && props.onDismissLine) await props.onDismissLine(line.id);
        else if (props.onDeleteLine) await props.onDeleteLine(line.id);
      }
    }
    setSelectedLineIds(new Set());
  }

  async function confirmRemoveFromTrip(lines: CostLineItemDraft[]) {
    const lineIds = lines.map((line) => line.id);
    if (props.onDeleteLines) {
      await props.onDeleteLines(lineIds, "removeFromTrip");
    } else {
      for (const line of lines) {
        const linked = Boolean(
          line.linkedStayId || line.linkedTransportLegId || line.linkedActivityId,
        );
        if (linked && props.onRemoveLineFromTrip) await props.onRemoveLineFromTrip(line.id);
        else if (props.onDeleteLine) await props.onDeleteLine(line.id);
      }
    }
    setSelectedLineIds(new Set());
  }

  const settings = props.costLedger.settings;
  const totalColCount = 3 + pool.length + 1;

  function sectionSubtotalCents(lines: CostLineItemDraft[]): number {
    return lines.reduce(
      (sum, line) =>
        sum + convertToBaseCents(line.totalAmountCents, line.currency, settings),
      0,
    );
  }

  function handleRowDrop(targetLineId: string) {
    if (!dragLineId || dragLineId === targetLineId || activeTab === "overall") return;
    const ids = tabLines.map((line) => line.id);
    const from = ids.indexOf(dragLineId);
    const to = ids.indexOf(targetLineId);
    if (from < 0 || to < 0) return;
    const next = [...ids];
    next.splice(from, 1);
    next.splice(to, 0, dragLineId);
    props.onReorderSectionLines?.(activeTab, next);
    setDragLineId(null);
    setDragOverLineId(null);
  }

  function renderAddRowRow() {
    if (activeTab === "overall" || !props.onAddExtraLine) return null;
    return (
      <tr className="bg-zinc-50/80">
        <td
          colSpan={2}
          className={`${tdClass} ${stickyColLeft} border border-zinc-300 bg-zinc-50/80`}
        >
          <button
            type="button"
            onClick={() => props.onAddExtraLine?.(activeTab)}
            className="flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-left text-[11px] font-medium text-violet-700 hover:bg-violet-100/60"
          >
            <span className="text-base leading-none">+</span>
            Add extra line
          </button>
        </td>
        <td
          colSpan={totalColCount - 2}
          className="border border-zinc-300 bg-zinc-50/80"
        />
      </tr>
    );
  }

  function renderLineRow(line: CostLineItemDraft, rowNumber: number) {
    const alloc = allocationByLine.get(line.id) ?? {};
    const lineResult = props.costLedger.lineAllocations.find(
      (l) => l.lineItemId === line.id,
    );
    const totalDisplay = formatLineTotal(line, settings);
    const isEmpty = line.totalAmountCents === 0;
    const lineAlloc = props.costLedger.lineAllocations.find((l) => l.lineItemId === line.id);
    const presenceHint =
      props.graph && presence
        ? presenceHintForLine(line, props.graph, props.roster, presence)
        : null;
    const spanLabel = props.graph ? lineDateSpanLabel(line, props.graph) : null;
    const stay = stayForLine(line, props.graph);

    const rowStickyBg =
      fillRowId === line.id
        ? "bg-violet-100"
        : selectedLineIds.has(line.id) || props.detailLineId === line.id
          ? "bg-violet-50"
          : "bg-white";
    const isLinkedTripRow = Boolean(
      line.linkedStayId || line.linkedTransportLegId || line.linkedActivityId,
    );
    const isFillingRow = fillRowId === line.id;

    return (
      <tr
        key={line.id}
        className={[
          "group cursor-pointer",
          isEmpty ? "text-zinc-400" : "",
          isFillingRow
            ? "bg-violet-100 ring-2 ring-inset ring-violet-400"
            : selectedLineIds.has(line.id) || props.detailLineId === line.id
              ? "bg-violet-50"
              : "bg-white",
          dragLineId === line.id ? "opacity-50" : "",
          dragOverLineId === line.id ? "ring-2 ring-inset ring-violet-300" : "",
        ].join(" ")}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOverLineId(line.id);
        }}
        onDrop={(e) => {
          e.preventDefault();
          handleRowDrop(line.id);
        }}
        onClick={(e) => {
          if ((e.target as HTMLElement).closest("input, button, [data-finance-cell]")) return;
          props.onOpenLineDetail?.(line.id);
        }}
      >
        <td
          className={`${tdClass} ${tdRowBg} ${stickyColLeft} ${rowStickyBg} group-hover:bg-zinc-50 text-center text-zinc-400`}
        >
          <div className="flex flex-col items-center gap-0.5">
            <span
              draggable
              onDragStart={(e) => {
                e.stopPropagation();
                setDragLineId(line.id);
              }}
              onDragEnd={() => {
                setDragLineId(null);
                setDragOverLineId(null);
              }}
              className="cursor-grab select-none text-[10px] leading-none text-zinc-300 hover:text-zinc-500 active:cursor-grabbing"
              title="Drag to reorder"
              aria-hidden
            >
              ⋮⋮
            </span>
            <input
              type="checkbox"
              checked={selectedLineIds.has(line.id)}
              onChange={() => toggleLineSelection(line.id)}
              className="rounded border-zinc-400"
              aria-label={`Select row ${rowNumber}`}
            />
            <span className="text-[10px] leading-none">{rowNumber}</span>
          </div>
        </td>
        <td
          className={`${tdTextClass} ${tdRowBg} ${stickyColDesc} ${rowStickyBg} group-hover:bg-zinc-50`}
        >
          <FinanceDescriptionCell
            line={line}
            openCell={openCell}
            setOpenCell={setOpenCell}
            onPatch={props.onPatchLine}
          />
          {spanLabel || presenceHint ? (
            <p className="mt-0.5 whitespace-nowrap text-[9px] text-zinc-400">
              {[spanLabel, presenceHint].filter(Boolean).join(" · ")}
            </p>
          ) : null}
          {isLinkedTripRow ? (
            <p className="mt-0.5 text-[9px] font-medium text-violet-700">Trip calendar row</p>
          ) : null}
          {props.onPatchParticipantsBulk ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (isFillingRow) exitPerPersonFill();
                else startPerPersonFill(line.id);
              }}
              className={[
                "mt-1 rounded border px-1.5 py-0.5 text-[9px] font-semibold",
                isFillingRow
                  ? "border-violet-600 bg-violet-600 text-white"
                  : "border-violet-300 bg-violet-50 text-violet-800 hover:bg-violet-100",
              ].join(" ")}
            >
              {isFillingRow ? "Done · per-person prices" : "Set per-person prices"}
            </button>
          ) : null}
          <FinanceStatusChips line={line} compact />
        </td>
        <td className={`${tdClass} ${tdRowBg} w-12 text-center`}>
          <FinanceQtyCell
            line={line}
            graph={props.graph}
            openCell={openCell}
            setOpenCell={setOpenCell}
            onPatch={props.onPatchLine}
          />
        </td>
        <td className={`${tdMoneyClass} ${tdRowBg}`}>
          <FinanceAmountCell
            line={line}
            graph={props.graph}
            displaySecondary={totalDisplay.secondary}
            onPatch={props.onPatchLine}
          />
        </td>
        {pool.map((participant) => {
          const isPresenceLine = Boolean(
            line.linkedStayId || line.linkedTransportLegId || line.linkedActivityId,
          );
          const eligibleFromPresence =
            isPresenceLine && props.graph && presence
              ? eligibleParticipantIdsForLine(
                  line,
                  props.graph,
                  props.roster,
                  presence,
                )
              : null;
          const eligible = new Set(
            eligibleFromPresence ?? lineAlloc?.eligibleParticipantIds ?? [],
          );
          const ineligible =
            eligibleFromPresence != null
              ? !eligible.has(participant.id)
              : eligible.size > 0 && !eligible.has(participant.id);
          const absenceMessage =
            ineligible &&
            props.graph &&
            presence &&
            absenceMessageForParticipant(
              line,
              props.graph,
              props.roster,
              presence,
              participant.id,
            );
          const isPinned = lineAlloc?.pinnedParticipantIds.includes(participant.id) ?? false;
          const amountCents = ineligible ? null : alloc[participant.id] ?? null;
          const participantNightCount =
            stay && presence && props.graph
              ? participantNightsForLine(line, participant.id, props.graph, presence)
              : null;
          const participantNightLabel =
            participantNightCount != null && participantNightCount > 0
              ? nightsLabel(participantNightCount)
              : null;

          return (
            <td
              key={participant.id}
              className={[
                `${tdParticipantClass} ${tdRowBg} text-right`,
                ineligible ? "!bg-zinc-50" : "",
                selectedParticipantIds.has(participant.id) ? "bg-violet-100/70" : "",
              ].join(" ")}
            >
              {ineligible && absenceMessage ? (
                <FinanceAbsentCell message={absenceMessage} />
              ) : (
                <FinanceParticipantAmountCell
                  amountCents={amountCents}
                  currency={line.currency}
                  isPinned={isPinned}
                  nightsLabel={participantNightLabel}
                  onSave={(cents) =>
                    props.onPatchParticipant(line.id, participant.id, cents)
                  }
                />
              )}
            </td>
          );
        })}
        <td className={`${tdClass} ${tdRowBg} text-center`}>
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
  }

  function renderSubtotalRow(
    label: string,
    lines: CostLineItemDraft[],
    rowClass = "bg-zinc-50 font-semibold",
    stickyBg = "bg-zinc-50",
  ) {
    const subtotal = sectionSubtotalCents(lines);
    const subtotalLabel = `${label} (${settings.baseCurrency})`;
    return (
      <tr className={rowClass}>
        <td className={`${tdClass} ${stickyColLeft} ${stickyBg} w-12`} />
        <td className={`${tdTextClass} ${stickyColDesc} ${stickyBg}`}>{subtotalLabel}</td>
        <td className={`${tdClass} ${stickyBg} w-12`} />
        <td className={`${tdMoneyClass} ${stickyBg}`}>
          {formatMoney(subtotal, settings.baseCurrency)}
        </td>
        {pool.map((participant) => {
          const sectionTotal = sectionTotalForParticipant(
            lines,
            participant.id,
            allocationByLine,
            settings,
          );
          return (
            <td
              key={participant.id}
              className={`${tdParticipantClass} ${stickyBg} text-right`}
            >
              {sectionTotal > 0 ? formatMoney(sectionTotal, settings.baseCurrency) : ""}
            </td>
          );
        })}
        <td className={`${tdClass} ${stickyBg}`} />
      </tr>
    );
  }

  const panelTitle =
    activeTab === "overall"
      ? "Overall"
      : FINANCE_SECTION_LABELS[activeTab];
  const panelDescription =
    activeTab === "overall"
      ? "Per-person totals across accommodation, transport, and activities"
      : fillRowId
        ? "Set each person’s fare on this trip row — row total and booking checks stay linked to the calendar"
        : FINANCE_SECTION_DESCRIPTIONS[activeTab];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 border-b border-zinc-200 bg-white px-3 pt-2">
        <div className="flex flex-wrap items-center gap-1">
          {FINANCE_ENTITY_SECTIONS.map((section) => {
            const count = linesBySection.get(section)?.length ?? 0;
            const active = activeTab === section;
            return (
              <button
                key={section}
                type="button"
                onClick={() => {
                  setActiveTab(section);
                  setSelectedLineIds(new Set());
                  setSelectedParticipantIds(new Set());
                  setFillRowId(null);
                }}
                className={[
                  "rounded-t-lg border border-b-0 px-3 py-2 text-[11px] font-semibold transition",
                  active
                    ? TAB_ACCENT[section]
                    : "border-transparent bg-zinc-100 text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900",
                ].join(" ")}
              >
                {FINANCE_SECTION_LABELS[section]}
                {count > 0 ? (
                  <span className="ml-1.5 rounded-full bg-white/80 px-1.5 py-0.5 text-[9px] font-medium tabular-nums">
                    {count}
                  </span>
                ) : null}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => {
              setActiveTab("overall");
              setSelectedLineIds(new Set());
              setSelectedParticipantIds(new Set());
              setFillRowId(null);
            }}
            className={[
              "rounded-t-lg border border-b-0 px-3 py-2 text-[11px] font-semibold transition",
              activeTab === "overall"
                ? TAB_ACCENT.overall
                : "border-transparent bg-zinc-100 text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900",
            ].join(" ")}
          >
            Overall
          </button>
          <div className="ml-auto flex items-center gap-2 pb-1">
            {!props.showEmptyLines && emptyCount > 0 ? (
              <span className="text-[10px] text-zinc-500">{emptyCount} empty hidden</span>
            ) : null}
            {activeTab !== "overall" ? (
              <button
                type="button"
                disabled={selectedLineIds.size === 0}
                onClick={openDeleteSelected}
                className="rounded border border-red-200 bg-red-50 px-2 py-1 text-[10px] font-medium text-red-800 disabled:cursor-not-allowed disabled:border-zinc-200 disabled:bg-zinc-100 disabled:text-zinc-400"
              >
                Delete selected{selectedLineIds.size > 0 ? ` (${selectedLineIds.size})` : ""}
              </button>
            ) : null}
          </div>
        </div>

        <div
          className={[
            "flex items-center justify-between gap-3 border px-3 py-2.5",
            activeTab === "overall"
              ? "border-zinc-200 bg-zinc-50/80"
              : `${TAB_PANEL_CLASS[activeTab as FinanceEntitySection]} border-t-0`,
          ].join(" ")}
        >
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-zinc-800">
              {panelTitle}
            </p>
            <p className="mt-0.5 text-[10px] text-zinc-600">{panelDescription}</p>
          </div>
          {activeTab !== "overall" ? (
            <p className="text-[10px] tabular-nums text-zinc-500">
              {tabLines.length} row{tabLines.length === 1 ? "" : "s"}
            </p>
          ) : null}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden bg-zinc-200/50 p-2">
        {bulkFillLine && props.onPatchParticipantsBulk ? (
          <FinanceBulkFillBar
            selectedRowLabel={bulkFillLine.description}
            linkedHint={linkedLegHint(bulkFillLine)}
            selectedParticipantCount={selectedParticipantIds.size}
            eligibleParticipantCount={eligibleIdsForLine(bulkFillLine).length}
            currency={bulkFillLine.currency}
            onApply={applyBulkFill}
            onSelectAll={() =>
              setSelectedParticipantIds(new Set(eligibleIdsForLine(bulkFillLine)))
            }
            onClearSelection={() => setSelectedParticipantIds(new Set())}
            onDone={exitPerPersonFill}
          />
        ) : null}
        {activeTab === "overall" ? (
          <div className="mb-2 px-1">
            <FinanceOverallSummary ledger={props.costLedger} />
            <FinanceWarningsPanel
              ledger={props.costLedger}
              onSelectLine={props.onOpenLineDetail}
            />
          </div>
        ) : null}
        <div className="h-max max-h-full w-full overflow-auto">
        <table className="w-max border-collapse bg-white text-left shadow-sm">
          <thead>
            <tr>
              <th
                className={`${thClass} ${stickyHeadCorner} left-0 w-12 text-center`}
              >
                {activeTab !== "overall" ? (
                  <>
                    <span className="sr-only">Select rows</span>
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      disabled={selectableLineIds.length === 0}
                      onChange={toggleSelectAllVisible}
                      className="rounded border-zinc-400"
                      aria-label="Select all visible rows"
                    />
                  </>
                ) : null}
              </th>
              <th className={`${thClass} ${stickyHeadCorner} left-12 min-w-[14rem]`}>
                {activeTab === "overall" ? "Category" : "Description"}
              </th>
              <th className={`${thMoneyClass} ${stickyHeadTop} w-12 text-center`}>
                {activeTab === "accommodation" ? "Nights" : "Qty"}
              </th>
              <th className={`${thMoneyClass} ${stickyHeadTop} ${moneyColWidth} text-right`}>
                Total
                <span className="mt-0.5 block text-[10px] font-normal text-zinc-500">
                  row currency
                </span>
              </th>
              {pool.map((participant) => {
                const label = participantHeaderLabel(participant, pool);
                const columnSelected = selectedParticipantIds.has(participant.id);
                return (
                  <th
                    key={participant.id}
                    className={[
                      `${thMoneyClass} ${stickyHeadTop} ${participantColWidth} text-center`,
                      columnSelected ? "bg-violet-200" : "",
                    ].join(" ")}
                    title={participant.fullName}
                  >
                    <FinanceParticipantHeader
                      label={label}
                      fullName={participant.fullName}
                      selected={columnSelected}
                      onToggle={
                        bulkFillLineId
                          ? () => toggleParticipantSelection(participant.id)
                          : undefined
                      }
                    />
                  </th>
                );
              })}
              <th className={`${thMoneyClass} ${stickyHeadTop} w-10 text-center`}>✓</th>
            </tr>
          </thead>
          <tbody>
            {pool.length === 0 ? (
              <tr>
                <td
                  colSpan={totalColCount}
                  className="border border-zinc-300 px-4 py-8 text-center text-[11px] text-zinc-500"
                >
                  No participants in cost split — check Users.
                </td>
              </tr>
            ) : activeTab === "overall" ? (
              <>
                {FINANCE_ENTITY_SECTIONS.map((section) => {
                  const lines = linesBySection.get(section) ?? [];
                  if (!lines.length) return null;
                  return (
                    <Fragment key={section}>
                      {renderSubtotalRow(FINANCE_SECTION_LABELS[section], lines, "hover:bg-zinc-50/80")}
                    </Fragment>
                  );
                })}
                {visibleLines.length === 0 ? (
                  <tr>
                    <td
                      colSpan={totalColCount}
                      className="border border-zinc-300 px-4 py-8 text-center text-[11px] text-zinc-500"
                    >
                      {emptyCount > 0 && !props.showEmptyLines
                        ? "Linked trip rows are hidden — click Show empty."
                        : "No rows yet — add stays, transport, or activities on the trip calendar."}
                    </td>
                  </tr>
                ) : (
                  renderSubtotalRow(
                    "Total per person",
                    visibleLines,
                    "bg-violet-100 font-bold",
                    "bg-violet-100",
                  )
                )}
              </>
            ) : tabLines.length === 0 ? (
              <>
                <tr>
                  <td
                    colSpan={totalColCount}
                    className="border border-zinc-300 px-4 py-4 text-center text-[11px] text-zinc-500"
                  >
                    {emptyCount > 0 && !props.showEmptyLines
                      ? `No ${FINANCE_SECTION_LABELS[activeTab].toLowerCase()} rows with amounts — click Show empty.`
                      : `No ${FINANCE_SECTION_LABELS[activeTab].toLowerCase()} rows from the calendar yet.`}
                  </td>
                </tr>
                {renderAddRowRow()}
              </>
            ) : (
              <>
                {tabLines.map((line, index) => renderLineRow(line, index + 1))}
                {renderAddRowRow()}
                {renderSubtotalRow(`${FINANCE_SECTION_LABELS[activeTab]} subtotal`, tabLines)}
              </>
            )}
          </tbody>
        </table>
        </div>
      </div>

      {pendingDeleteLines?.length ? (
        <FinanceDeleteModal
          lines={pendingDeleteLines}
          onCancel={() => setPendingDeleteLines(null)}
          onFinanceOnly={async () => {
            const lines = pendingDeleteLines;
            setPendingDeleteLines(null);
            if (!lines?.length) return;
            await confirmFinanceOnlyDelete(lines);
          }}
          onRemoveFromTrip={async () => {
            const lines = pendingDeleteLines;
            setPendingDeleteLines(null);
            if (!lines?.length) return;
            await confirmRemoveFromTrip(lines);
          }}
        />
      ) : null}
    </div>
  );
}
