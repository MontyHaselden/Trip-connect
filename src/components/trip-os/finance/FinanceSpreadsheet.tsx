"use client";

import { Fragment, useEffect, useMemo, useState } from "react";

import type { CostLedgerProjection } from "@/lib/trip-engine/cost-ledger/types";
import {
  buildParticipantPresenceMap,
} from "@/lib/trip-engine/cost-ledger/presence";
import {
  absenceMessageForParticipant,
  financeSectionDescription,
  financeSectionExpensesLabel,
  financeSectionForLine,
  financeSectionLabel,
  financeSectionList,
  groupLinesByFinanceSection,
  isFinanceCalendarSection,
  isFinanceCustomSection,
  logisticsGrossForParticipant,
  supportsManualExpenseLines,
  type FinanceBuiltInSection,
  type FinanceEntitySection,
} from "@/lib/trip-engine/cost-ledger/finance-sections";
import { eligibleParticipantIdsForLine } from "@/lib/trip-engine/cost-ledger/presence";
import type { TripEntityGraph } from "@/lib/trip-engine/types";
import {
  participantHeaderLabel,
} from "@/lib/trip-engine/cost-ledger/display-utils";
import { formatMoney, convertToBaseCents } from "@/lib/trip-engine/cost-ledger/format-money";
import { convertCentsBetweenCurrencies } from "@/lib/trip-engine/cost-ledger/exchange-rates";
import {
  effectiveLineTotalCents,
  sectionLinesSubtotalCents,
} from "@/lib/trip-engine/cost-ledger/finance-grid-totals";
import {
  effectiveStayNights,
  nightsLabel,
  participantNightsForLine,
  perNightCents,
  stayForLine,
} from "@/lib/trip-engine/cost-ledger/accommodation-nights";
import type { RosterSummary } from "@/lib/trip-engine/types";

import type { CostLineFormValues } from "../costs/CostLineDrawer";
import type { FinanceLinePatch } from "./finance-line-patch";
import type { CostsPatchResult } from "../useTripOsEngine";
import { FinanceDeleteModal } from "./FinanceDeleteModal";
import { FinanceWarningsPanel } from "./FinanceWarningsPanel";
import type { CostLineItemDraft, TripFundDraft } from "@/lib/trip-engine/cost-ledger/types";
import {
  FinanceAmountCell,
  FinanceDescriptionCell,
  FinanceParticipantAmountCell,
  FinanceQtyCell,
  type OpenCell,
} from "./FinanceCellEditors";
import { FinanceAbsentCell } from "./FinanceAbsentCell";
import {
  FinancePerPersonPricesModal,
  type FinancePriceParticipant,
} from "./FinancePerPersonPricesModal";
import { FinanceParticipantHeader } from "./FinanceParticipantHeader";
import { filterParticipantsForFinanceSection } from "@/lib/trip-engine/cost-ledger/finance-section-exclusions";
import { FinanceByPersonView } from "./FinanceByPersonView";
import { FinanceByGroupView } from "./FinanceByGroupView";
import { FinanceGridFooter, FinanceSectionSummaryRow, type FinanceGridIncomeMode } from "./FinanceGridFooter";
import {
  financeDescStickyLeft,
  financeHeadDescSticky,
  financeHeadRailSticky,
  financeRailStickyLeft,
} from "./finance-grid-rail";
import { FinanceAddLineButton } from "./FinanceAddLineButton";
import { fundHasPinnedPrices } from "./finance-fund-patch";
import { FinanceAddSectionModal } from "./FinanceAddSectionModal";
import { FinanceDeleteSectionModal } from "./FinanceDeleteSectionModal";
import { financeCalendarEmptyNote } from "./FinanceCalendarEmptyState";
import { FinanceLineStatusBadge } from "../shared/FinanceLineStatusBadge";
import { lineFinanceAttentionReason, lineFinanceDisplayStatus } from "@/lib/trip-engine/cost-ledger/finance-section-readiness";
import { TripOsCurrencyCalculatorHub } from "../currency/TripOsCurrencyCalculatorHub";
import { transportLegRouteLabel } from "@/lib/trip-engine/transport-route-label";
import { fundsForFinanceSection, fundsForOverallView, isOrphanFinanceFund } from "@/lib/trip-engine/cost-ledger/finance-fund-sections";
import type { FinanceViewGroup } from "@/lib/trip-engine/cost-ledger/types";

type FinanceSummaryTab = "overall" | "byPerson" | "byGroup";
type FinanceTab = FinanceEntitySection | FinanceSummaryTab;

function isEntitySectionTab(tab: FinanceTab): tab is FinanceEntitySection {
  return tab !== "overall" && tab !== "byPerson" && tab !== "byGroup";
}

function supportsFinanceRowSelection(tab: FinanceTab): boolean {
  if (tab === "overall") return true;
  return isEntitySectionTab(tab) && supportsManualExpenseLines(tab);
}

function isCalendarFinanceSectionTab(tab: FinanceTab): tab is FinanceBuiltInSection {
  return isEntitySectionTab(tab) && isFinanceCalendarSection(tab);
}

/** Pending per-person cell edits — keyed by line id then participant id. */
type PendingAllocations = Record<string, Record<string, number | null>>;

function effectiveParticipantCents(
  lineId: string,
  participantId: string,
  ledgerCents: number | null | undefined,
  pending: PendingAllocations,
): number | null {
  const rowPending = pending[lineId];
  if (rowPending && participantId in rowPending) {
    return rowPending[participantId];
  }
  return ledgerCents ?? null;
}

function participantTotalCents(
  lines: CostLineItemDraft[],
  participantId: string,
  allocationByLine: Map<string, Record<string, number>>,
  pending: PendingAllocations,
  settings: CostLedgerProjection["settings"],
): number {
  return lines.reduce((sum, line) => {
    const ledgerCents = allocationByLine.get(line.id)?.[participantId];
    const cents = effectiveParticipantCents(line.id, participantId, ledgerCents, pending);
    if (cents == null || cents <= 0) return sum;
    return sum + convertToBaseCents(cents, line.currency, settings);
  }, 0);
}

const thClass =
  "border border-zinc-300 bg-white px-2.5 py-2 text-xs font-semibold text-zinc-700 align-middle";
const thMoneyClass =
  "border border-zinc-300 bg-white px-2 py-2 text-xs font-semibold text-zinc-700 align-middle whitespace-nowrap";
const thParticipantHeadClass =
  "border border-zinc-300 bg-white px-2.5 py-3.5 text-xs text-zinc-700 align-middle overflow-hidden min-h-[2.75rem]";
/** Min width only — columns grow to fit the widest amount in that column. */
function moneyColWidth(displayCurrency: string): string {
  return displayCurrency === "JPY" ? "min-w-[8rem]" : "min-w-[6.5rem]";
}
function participantColWidth(displayCurrency: string): string {
  return displayCurrency === "JPY"
    ? "w-[7rem] min-w-[7rem] max-w-[7rem]"
    : "w-[5.5rem] min-w-[5.5rem] max-w-[5.5rem]";
}
const tdClass =
  "border border-zinc-300 px-2.5 py-2 text-xs text-zinc-800 tabular-nums align-middle";
const tdMoneyClass = `${tdClass} whitespace-nowrap`;
const tdParticipantClass = `${tdClass} whitespace-nowrap`;
const tdTextClass =
  "border border-zinc-300 px-3 py-2 text-xs text-zinc-800 align-middle";
const tdRowBg = "bg-white group-hover:bg-zinc-50";

/** Opaque sticky layers — no transparency so scrolled cells don't bleed through. */
const stickyHeadCorner = financeHeadRailSticky;
const stickyHeadTop = "sticky top-0 z-20 bg-white";
const stickyHeadParticipant = "sticky top-0 z-20 bg-white";
const stickyColLeft = financeRailStickyLeft;
const stickyColDesc = financeDescStickyLeft;
const stickyHeadDesc = financeHeadDescSticky;

const TAB_ACCENT: Record<string, string> = {
  accommodation: "border-sky-500 text-sky-800 bg-sky-50",
  transport: "border-violet-500 text-violet-800 bg-violet-50",
  activities: "border-amber-500 text-amber-900 bg-amber-50",
  other: "border-rose-500 text-rose-900 bg-rose-50",
  overall: "border-zinc-500 text-zinc-800 bg-zinc-50",
  byPerson: "border-zinc-500 text-zinc-800 bg-zinc-50",
  byGroup: "border-zinc-500 text-zinc-800 bg-zinc-50",
};

export function FinanceSpreadsheet(props: {
  tripId: string;
  costLedger: CostLedgerProjection;
  roster: RosterSummary;
  graph?: TripEntityGraph | null;
  showEmptyLines: boolean;
  displayCurrency: string;
  exchangeRates: Record<string, number>;
  onPatchLine: (lineId: string, patch: FinanceLinePatch) => void;
  onPatchParticipant: (
    lineId: string,
    participantId: string,
    amountCents: number | null,
  ) => void;
  onPatchParticipantsBulk?: (
    lineId: string,
    allocations: { participantId: string; amountCents: number }[],
  ) => Promise<CostsPatchResult>;
  onDismissLine?: (lineId: string) => Promise<void>;
  onDeleteLine?: (lineId: string) => Promise<void>;
  onRemoveLineFromTrip?: (lineId: string) => Promise<void>;
  onDeleteLines?: (
    lineIds: string[],
    mode: "financeOnly" | "removeFromTrip",
  ) => Promise<void>;
  onAddExtraLine?: (section: FinanceEntitySection) => void;
  onReorderSectionLines?: (section: FinanceEntitySection, orderedIds: string[]) => void;
  onAddFinanceSection?: (name: string, description: string) => Promise<boolean>;
  onDeleteFinanceSection?: (sectionId: string) => Promise<boolean>;
  onSaveFinanceViewGroups?: (groups: FinanceViewGroup[]) => Promise<boolean>;
  onSetSectionParticipant?: (
    section: FinanceEntitySection,
    participantId: string,
    excluded: boolean,
  ) => Promise<void>;
  onRemoveFromFinance?: (participantId: string) => Promise<void>;
  onAddIncomeLine?: (section: FinanceEntitySection | null) => void;
  onUpdateFund?: (
    fundId: string,
    patch: {
      name?: string;
      amountCents?: number;
      allocationRulePayload?: TripFundDraft["allocationRulePayload"];
    },
  ) => void;
  onPatchFundParticipantsBulk?: (
    fundId: string,
    allocations: { participantId: string; amountCents: number }[],
  ) => Promise<CostsPatchResult>;
  onPatchFundParticipant?: (
    fundId: string,
    participantId: string,
    amountCents: number | null,
  ) => void;
  onDeleteFund?: (fundId: string) => void | Promise<unknown>;
  onDeleteFunds?: (fundIds: string[]) => Promise<CostsPatchResult>;
  onDeletePayment?: (paymentId: string) => void;
  saving?: boolean;
  focusSectionTab?: FinanceBuiltInSection | null;
  focusLineId?: string | null;
  onFocusConsumed?: () => void;
}) {
  const [activeTab, setActiveTab] = useState<FinanceTab>("accommodation");
  const [openCell, setOpenCell] = useState<OpenCell>(null);
  const [selectedLineIds, setSelectedLineIds] = useState<Set<string>>(new Set());
  const [selectedFundIds, setSelectedFundIds] = useState<Set<string>>(new Set());
  const [pendingDeleteFundIds, setPendingDeleteFundIds] = useState<string[]>([]);
  const [pendingDeleteLines, setPendingDeleteLines] = useState<CostLineItemDraft[] | null>(null);
  const [dragLineId, setDragLineId] = useState<string | null>(null);
  const [dragOverLineId, setDragOverLineId] = useState<string | null>(null);
  const [pricingLineId, setPricingLineId] = useState<string | null>(null);
  const [pricingFundId, setPricingFundId] = useState<string | null>(null);
  const [pricingError, setPricingError] = useState<string | null>(null);
  const [addSectionOpen, setAddSectionOpen] = useState(false);
  const [deleteSectionId, setDeleteSectionId] = useState<string | null>(null);
  const [byPersonId, setByPersonId] = useState<string | null>(null);
  const [byGroupId, setByGroupId] = useState<string | null>(null);
  const [pendingAllocations, setPendingAllocations] = useState<PendingAllocations>({});
  const [pendingLineTotals, setPendingLineTotals] = useState<Record<string, number>>({});
  useEffect(() => {
    if (!props.focusSectionTab && !props.focusLineId) return;
    if (props.focusSectionTab) setActiveTab(props.focusSectionTab);
    if (props.focusLineId) {
      requestAnimationFrame(() => {
        document
          .getElementById(`finance-line-${props.focusLineId}`)
          ?.scrollIntoView({ block: "center", behavior: "smooth" });
      });
    }
    props.onFocusConsumed?.();
  }, [props.focusSectionTab, props.focusLineId, props.onFocusConsumed]);

  const canAddManualExpenseLine =
    isEntitySectionTab(activeTab) &&
    Boolean(props.onAddExtraLine) &&
    supportsManualExpenseLines(activeTab);

  function setPendingAllocation(
    lineId: string,
    participantId: string,
    amountCents: number | null,
  ) {
    setPendingAllocations((prev) => {
      const next = { ...prev };
      const row = { ...(next[lineId] ?? {}) };
      row[participantId] = amountCents;
      next[lineId] = row;
      return next;
    });
  }

  useEffect(() => {
    setPendingAllocations((prev) => {
      if (!Object.keys(prev).length) return prev;
      const next: PendingAllocations = {};
      let changed = false;
      for (const [lineId, byParticipant] of Object.entries(prev)) {
        const ledgerAlloc = props.costLedger.lineAllocations.find(
          (row) => row.lineItemId === lineId,
        )?.allocations;
        if (!ledgerAlloc) {
          next[lineId] = byParticipant;
          continue;
        }
        const rowNext: Record<string, number | null> = {};
        for (const [participantId, pendingCents] of Object.entries(byParticipant)) {
          const ledgerCents = ledgerAlloc[participantId] ?? null;
          if (pendingCents !== ledgerCents) {
            rowNext[participantId] = pendingCents;
          } else {
            changed = true;
          }
        }
        if (Object.keys(rowNext).length) next[lineId] = rowNext;
        else if (Object.keys(byParticipant).length) changed = true;
      }
      return changed || Object.keys(next).length !== Object.keys(prev).length ? next : prev;
    });
  }, [props.costLedger.lineAllocations]);

  useEffect(() => {
    setPendingLineTotals((prev) => {
      if (!Object.keys(prev).length) return prev;
      const next: Record<string, number> = {};
      let changed = false;
      for (const [lineId, pendingTotal] of Object.entries(prev)) {
        const line = props.costLedger.lineItems.find((row) => row.id === lineId);
        if (!line) {
          next[lineId] = pendingTotal;
          continue;
        }
        if (line.totalAmountCents !== pendingTotal) {
          next[lineId] = pendingTotal;
        } else {
          changed = true;
        }
      }
      return changed || Object.keys(next).length !== Object.keys(prev).length ? next : prev;
    });
  }, [props.costLedger.lineItems]);

  function handlePatchLine(lineId: string, patch: FinanceLinePatch) {
    if (patch.totalAmountCents !== undefined) {
      setPendingLineTotals((prev) => ({
        ...prev,
        [lineId]: patch.totalAmountCents ?? 0,
      }));
    }
    props.onPatchLine(lineId, patch);
  }

  function handlePendingLineTotal(lineId: string, totalCents: number | null) {
    setPendingLineTotals((prev) => {
      if (totalCents == null || totalCents <= 0) {
        if (!(lineId in prev)) return prev;
        const next = { ...prev };
        delete next[lineId];
        return next;
      }
      if (prev[lineId] === totalCents) return prev;
      return { ...prev, [lineId]: totalCents };
    });
  }

  const settings = props.costLedger.settings;
  const [instantSectionExclusions, setInstantSectionExclusions] = useState<
    Record<string, string[]>
  >({});

  const effectiveSettings = useMemo(() => {
    const merged = { ...settings.financeSectionExclusions };
    for (const [section, ids] of Object.entries(instantSectionExclusions)) {
      merged[section] = [...new Set([...(merged[section] ?? []), ...ids])];
    }
    return { ...settings, financeSectionExclusions: merged };
  }, [settings, instantSectionExclusions]);

  useEffect(() => {
    setInstantSectionExclusions((prev) => {
      if (!Object.keys(prev).length) return prev;
      const next: Record<string, string[]> = {};
      let changed = false;
      for (const [section, ids] of Object.entries(prev)) {
        const onServer = new Set(settings.financeSectionExclusions[section] ?? []);
        const remaining = ids.filter((id) => !onServer.has(id));
        if (remaining.length !== ids.length) changed = true;
        if (remaining.length) next[section] = remaining;
      }
      return changed ? next : prev;
    });
  }, [settings.financeSectionExclusions]);

  function handleSetSectionParticipant(
    section: FinanceEntitySection,
    participantId: string,
    excluded: boolean,
  ) {
    setInstantSectionExclusions((prev) => {
      const next = { ...prev };
      const current = new Set(next[section] ?? []);
      if (excluded) current.add(participantId);
      else current.delete(participantId);
      if (current.size) next[section] = [...current];
      else delete next[section];
      return next;
    });
    void props.onSetSectionParticipant?.(section, participantId, excluded);
  }

  const displayCurrency = props.displayCurrency;
  const baseCurrency = settings.baseCurrency;
  const ratesFromBase = props.exchangeRates;
  const moneyCol = moneyColWidth(displayCurrency);
  const participantCol = participantColWidth(displayCurrency);

  function formatDisplayFromBase(cents: number): string {
    if (cents <= 0) return "";
    const displayCents =
      displayCurrency === baseCurrency
        ? cents
        : convertCentsBetweenCurrencies(
            cents,
            baseCurrency,
            displayCurrency,
            baseCurrency,
            ratesFromBase,
          );
    return formatMoney(displayCents, displayCurrency);
  }

  const moneyCellProps = {
    displayCurrency,
    baseCurrency,
    ratesFromBase,
  };

  const sectionList = useMemo(() => financeSectionList(settings), [settings]);

  const presence = useMemo(
    () =>
      props.graph ? buildParticipantPresenceMap(props.graph, props.roster) : undefined,
    [props.graph, props.roster],
  );

  const fullPool = useMemo(
    () => props.roster.participants.filter((p) => p.inCostSplit && p.role !== "host"),
    [props.roster.participants],
  );

  const pool = useMemo(() => {
    if (!isEntitySectionTab(activeTab)) return fullPool;
    return filterParticipantsForFinanceSection(fullPool, effectiveSettings, activeTab);
  }, [fullPool, effectiveSettings, activeTab]);

  const hiddenInSection = useMemo(() => {
    if (!isEntitySectionTab(activeTab)) return [];
    const excluded = new Set(effectiveSettings.financeSectionExclusions[activeTab] ?? []);
    return fullPool.filter((p) => excluded.has(p.id));
  }, [fullPool, effectiveSettings.financeSectionExclusions, activeTab]);

  const allocationByLine = useMemo(() => {
    const map = new Map<string, Record<string, number>>();
    for (const row of props.costLedger.lineAllocations) {
      map.set(row.lineItemId, row.allocations);
    }
    return map;
  }, [props.costLedger.lineAllocations]);

  const visibleLines = useMemo(() => {
    const lines = props.costLedger.lineItems.filter(
      (line) => financeSectionForLine(line, props.graph, settings) != null,
    );
    if (props.showEmptyLines) return lines;
    return lines.filter((l) => {
      const lineAlloc = props.costLedger.lineAllocations.find((row) => row.lineItemId === l.id);
      return effectiveLineTotalCents(l, lineAlloc) > 0;
    });
  }, [props.costLedger.lineItems, props.showEmptyLines, props.graph, settings]);

  const emptyCount = props.costLedger.lineItems.filter((l) => l.totalAmountCents === 0).length;

  const linesBySection = useMemo(
    () => groupLinesByFinanceSection(visibleLines, props.graph, settings),
    [visibleLines, props.graph, settings],
  );

  const tabLines = useMemo(() => {
    if (!isEntitySectionTab(activeTab)) return [];
    return linesBySection.get(activeTab) ?? [];
  }, [activeTab, linesBySection]);

  const deleteSectionTarget = useMemo(() => {
    if (!deleteSectionId) return null;
    const custom = settings.financeCustomSections.find((section) => section.id === deleteSectionId);
    if (!custom) return null;
    const lines =
      props.costLedger.lineItems.filter(
        (line) => financeSectionForLine(line, props.graph, settings) === deleteSectionId,
      ).length;
    const funds = fundsForFinanceSection(props.costLedger.funds, deleteSectionId).length;
    return { ...custom, lineCount: lines, fundCount: funds };
  }, [deleteSectionId, settings, props.costLedger, props.graph]);

  const sectionFunds = useMemo(() => {
    if (isEntitySectionTab(activeTab)) {
      return fundsForFinanceSection(props.costLedger.funds, activeTab);
    }
    if (activeTab === "overall") {
      return fundsForOverallView(props.costLedger.funds);
    }
    return [];
  }, [activeTab, props.costLedger.funds, settings]);

  const selectableFundIds = useMemo(
    () => sectionFunds.map((fund) => fund.id),
    [sectionFunds],
  );

  const pricingLine = useMemo(() => {
    if (!pricingLineId) return null;
    return (
      tabLines.find((line) => line.id === pricingLineId) ??
      props.costLedger.lineItems.find((line) => line.id === pricingLineId) ??
      null
    );
  }, [pricingLineId, tabLines, props.costLedger.lineItems]);

  const pricingFund = useMemo(() => {
    if (!pricingFundId) return null;
    return (
      sectionFunds.find((fund) => fund.id === pricingFundId) ??
      props.costLedger.funds.find((fund) => fund.id === pricingFundId) ??
      null
    );
  }, [pricingFundId, sectionFunds, props.costLedger.funds]);

  function eligibleIdsForLine(line: CostLineItemDraft): string[] {
    if (props.graph && presence) {
      return eligibleParticipantIdsForLine(line, props.graph, props.roster, presence);
    }
    return pool.map((p) => p.id);
  }

  const pricingParticipants = useMemo((): FinancePriceParticipant[] => {
    if (!pricingLine) return [];
    const eligible = eligibleIdsForLine(pricingLine);
    const lineAlloc = props.costLedger.lineAllocations.find(
      (row) => row.lineItemId === pricingLine.id,
    );
    const alloc = lineAlloc?.allocations ?? {};
    const pinned = new Set(lineAlloc?.pinnedParticipantIds ?? []);
    return pool
      .filter((p) => eligible.includes(p.id))
      .map((p) => ({
        id: p.id,
        fullName: p.fullName,
        amountCents: alloc[p.id] ?? null,
        isPinned: pinned.has(p.id),
      }));
  }, [pricingLine, pool, props.costLedger.lineAllocations, props.graph, presence, props.roster]);

  const pricingFundParticipants = useMemo((): FinancePriceParticipant[] => {
    if (!pricingFund) return [];
    const pinned = new Set(
      Object.keys(pricingFund.allocationRulePayload.pinnedAllocations ?? {}),
    );
    const alloc = props.costLedger.fundAllocations[pricingFund.id] ?? {};
    return pool.map((p) => ({
      id: p.id,
      fullName: p.fullName,
      amountCents: alloc[p.id] ?? null,
      isPinned: pinned.has(p.id),
    }));
  }, [pricingFund, pool, props.costLedger.fundAllocations]);

  const selectableLineIds = useMemo(
    () => (isEntitySectionTab(activeTab) ? tabLines.map((line) => line.id) : []),
    [activeTab, tabLines],
  );

  const allVisibleSelected =
    (selectableLineIds.length > 0 || selectableFundIds.length > 0) &&
    selectableLineIds.every((id) => selectedLineIds.has(id)) &&
    selectableFundIds.every((id) => selectedFundIds.has(id));

  const totalSelectedCount = selectedLineIds.size + selectedFundIds.size;

  function toggleFundSelection(fundId: string) {
    setSelectedFundIds((prev) => {
      const next = new Set(prev);
      if (next.has(fundId)) next.delete(fundId);
      else next.add(fundId);
      return next;
    });
  }

  async function deleteSelectedFunds(fundIds: string[]) {
    if (!fundIds.length) return;
    if (props.onDeleteFunds) {
      const result = await props.onDeleteFunds(fundIds);
      if (!result.ok) return;
    } else {
      for (const id of fundIds) {
        await props.onDeleteFund?.(id);
      }
    }
    setSelectedFundIds(new Set());
  }

  function toggleLineSelection(lineId: string) {
    setSelectedLineIds((prev) => {
      const next = new Set(prev);
      if (next.has(lineId)) next.delete(lineId);
      else next.add(lineId);
      return next;
    });
  }

  async function applyPerPersonPrices(
    allocations: { participantId: string; amountCents: number }[],
  ) {
    if (!pricingLine || !props.onPatchParticipantsBulk) return;
    const lineId = pricingLine.id;
    setPricingLineId(null);
    setPricingError(null);
    setPendingAllocations((prev) => {
      const row: Record<string, number | null> = { ...(prev[lineId] ?? {}) };
      for (const { participantId, amountCents } of allocations) {
        row[participantId] = amountCents;
      }
      return { ...prev, [lineId]: row };
    });
    const result = await props.onPatchParticipantsBulk(lineId, allocations);
    if (!result.ok) {
      setPricingError(result.error);
      return;
    }
    setPendingAllocations((prev) => {
      if (!prev[lineId]) return prev;
      const next = { ...prev };
      delete next[lineId];
      return next;
    });
  }

  async function applyPerPersonFundPrices(
    allocations: { participantId: string; amountCents: number }[],
  ) {
    if (!pricingFund || !props.onPatchFundParticipantsBulk) return;
    const fundId = pricingFund.id;
    setPricingFundId(null);
    setPricingError(null);
    const result = await props.onPatchFundParticipantsBulk(fundId, allocations);
    if (!result.ok) setPricingError(result.error);
  }

  function linkedLegHint(line: CostLineItemDraft): string | null {
    if (!props.graph) return null;
    if (line.linkedTransportProductId) {
      const product = (props.graph.transportProducts ?? []).find(
        (row) => row.id === line.linkedTransportProductId,
      );
      return product
        ? `Transport product · ${product.name}`
        : "Linked transport product";
    }
    if (line.linkedTransportLegId) {
      const leg = [
        ...props.graph.outboundLegs,
        ...props.graph.returnLegs,
        ...props.graph.intercityLegs,
      ].find((l) => l.id === line.linkedTransportLegId);
      if (!leg) return "Linked to trip transport leg";
      return `From trip calendar · ${transportLegRouteLabel(leg, props.graph)}`;
    }
    if (line.linkedStayId) return "From trip calendar · accommodation stay";
    if (line.linkedActivityId) return "From trip calendar · activity";
    return null;
  }

  function toggleSelectAllVisible() {
    setSelectedLineIds(() =>
      allVisibleSelected ? new Set() : new Set(selectableLineIds),
    );
    setSelectedFundIds(() =>
      allVisibleSelected ? new Set() : new Set(selectableFundIds),
    );
  }

  function openDeleteSelected() {
    const lines = tabLines.filter((line) => selectedLineIds.has(line.id));
    const fundIds = [...selectedFundIds];
    if (!lines.length && !fundIds.length) return;

    if (!lines.length) {
      void deleteSelectedFunds(fundIds);
      return;
    }

    setPendingDeleteFundIds(fundIds);
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

  const showRailStatus = isCalendarFinanceSectionTab(activeTab);
  const totalColCount = 3 + pool.length + (showRailStatus ? 0 : 1);

  function sectionSubtotalCents(lines: CostLineItemDraft[]): number {
    return sectionLinesSubtotalCents(
      lines,
      props.costLedger.lineAllocations,
      settings,
      pendingAllocations,
      pendingLineTotals,
    );
  }

  function handleRowDrop(targetLineId: string) {
    if (!dragLineId || dragLineId === targetLineId || !isEntitySectionTab(activeTab)) return;
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


  function renderLineRow(line: CostLineItemDraft, rowNumber: number) {
    const alloc = allocationByLine.get(line.id) ?? {};
    const lineAlloc = props.costLedger.lineAllocations.find((l) => l.lineItemId === line.id);
    const rowTotalCents = effectiveLineTotalCents(
      line,
      lineAlloc,
      pendingAllocations[line.id],
      pendingLineTotals[line.id],
    );
    const isEmpty = rowTotalCents === 0;
    const hasPinnedPrices = (lineAlloc?.pinnedParticipantIds.length ?? 0) > 0;
    const financeStatus = lineFinanceDisplayStatus(
      line,
      props.costLedger,
      pendingAllocations[line.id],
    );
    const showTbcAction = financeStatus === "needs_attention";
    const stay = stayForLine(line, props.graph);

    const rowStickyBg =
      pricingLineId === line.id
        ? "bg-violet-50"
        : selectedLineIds.has(line.id)
          ? "bg-violet-50"
          : "bg-white";

    const rowDimClass = dragLineId === line.id ? "opacity-50" : "";

    return (
      <tr
        key={line.id}
        id={`finance-line-${line.id}`}
        className={[
          "group",
          isEmpty ? "text-zinc-400" : "",
          selectedLineIds.has(line.id) || pricingLineId === line.id
            ? "bg-violet-50"
            : "bg-white",
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
              className="flex cursor-grab select-none items-center justify-center rounded border border-zinc-200 bg-zinc-50 px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-zinc-500 hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700 active:cursor-grabbing"
              title="Drag to reorder"
            >
              Move
            </span>
            {showRailStatus ? (
              <FinanceLineStatusBadge
                status={lineFinanceDisplayStatus(
                  line,
                  props.costLedger,
                  pendingAllocations[line.id],
                )}
                attentionReason={lineFinanceAttentionReason(
                  line,
                  props.costLedger,
                  pendingAllocations[line.id],
                )}
                variant="rail"
                onNeedsAttention={() => setPricingLineId(line.id)}
              />
            ) : (
              <input
                type="checkbox"
                checked={selectedLineIds.has(line.id)}
                onChange={() => toggleLineSelection(line.id)}
                className="rounded border-zinc-400"
                aria-label={`Select row ${rowNumber}`}
              />
            )}
            <span className="text-[10px] leading-none">{rowNumber}</span>
          </div>
        </td>
        <td
          className={`${tdTextClass} ${tdRowBg} ${stickyColDesc} ${rowStickyBg} group-hover:bg-zinc-50`}
        >
          <div className="min-w-0 flex-1">
            <FinanceDescriptionCell
              line={line}
              graph={props.graph}
              openCell={openCell}
              setOpenCell={setOpenCell}
              onPatch={handlePatchLine}
            />
            {props.onPatchParticipantsBulk ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setPricingLineId(line.id);
                }}
                className="mt-1 rounded border border-violet-300 bg-violet-50 px-1.5 py-0.5 text-[9px] font-semibold text-violet-800 hover:bg-violet-100"
              >
                {hasPinnedPrices ? "Edit per-person prices" : "Set per-person prices"}
              </button>
            ) : null}
            {showTbcAction ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  props.onPatchLine(line.id, { costStatus: "tbc" });
                }}
                className="mt-1 rounded border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[9px] font-semibold text-amber-900 hover:bg-amber-100"
              >
                Mark TBC
              </button>
            ) : null}
          </div>
        </td>
        <td className={`${tdClass} ${tdRowBg} w-12 text-center ${rowDimClass}`}>
          <FinanceQtyCell
            line={line}
            graph={props.graph}
            openCell={openCell}
            setOpenCell={setOpenCell}
            onPatch={handlePatchLine}
          />
        </td>
        <td className={`${tdMoneyClass} ${moneyCol} ${tdRowBg} text-center ${rowDimClass}`}>
          <FinanceAmountCell
            line={line}
            graph={props.graph}
            displayTotalCents={rowTotalCents}
            {...moneyCellProps}
            onPatch={handlePatchLine}
            onPendingTotalChange={handlePendingLineTotal}
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
          const ledgerCents = ineligible ? null : alloc[participant.id] ?? null;
          const amountCents = ineligible
            ? null
            : effectiveParticipantCents(
                line.id,
                participant.id,
                ledgerCents,
                pendingAllocations,
              );
          const stayNights = stay ? effectiveStayNights(line, props.graph) : null;
          const participantNightCount =
            stay && presence && props.graph
              ? participantNightsForLine(line, participant.id, props.graph, presence)
              : null;
          const participantNightLabel =
            participantNightCount != null &&
            stayNights != null &&
            participantNightCount > 0 &&
            participantNightCount < stayNights
              ? nightsLabel(participantNightCount)
              : null;

          return (
            <td
              key={participant.id}
              className={`${tdParticipantClass} ${participantCol} ${tdRowBg} text-right ${rowDimClass} ${ineligible ? "!bg-zinc-50" : ""}`}
            >
              {ineligible && absenceMessage ? (
                <FinanceAbsentCell message={absenceMessage} />
              ) : (
                <FinanceParticipantAmountCell
                  amountCents={amountCents}
                  currency={line.currency}
                  isPinned={isPinned}
                  nightsLabel={participantNightLabel}
                  {...moneyCellProps}
                  onSave={(cents) => {
                    setPendingAllocation(line.id, participant.id, cents);
                    props.onPatchParticipant(line.id, participant.id, cents);
                  }}
                  onDraftChange={(cents) =>
                    setPendingAllocation(line.id, participant.id, cents)
                  }
                />
              )}
            </td>
          );
        })}
        {!showRailStatus ? (
          <td className={`${tdClass} ${tdRowBg} text-center ${rowDimClass}`}>
            {rowTotalCents === 0 ? (
              ""
            ) : (
              <FinanceLineStatusBadge
                status={lineFinanceDisplayStatus(
                  line,
                  props.costLedger,
                  pendingAllocations[line.id],
                )}
                attentionReason={lineFinanceAttentionReason(
                  line,
                  props.costLedger,
                  pendingAllocations[line.id],
                )}
                variant="rail"
                onNeedsAttention={() => setPricingLineId(line.id)}
              />
            )}
          </td>
        ) : null}
      </tr>
    );
  }

  function gridFooterStyles() {
    return {
      tdClass,
      tdMoneyClass,
      tdTextClass,
      tdParticipantClass,
      moneyCol,
      participantCol,
      stickyColLeft,
      stickyColDesc,
      formatDisplayFromBase,
    };
  }

  function renderExpensesSummaryRow(lines: CostLineItemDraft[]) {
    const expenseAddAction = canAddManualExpenseLine ? (
      <FinanceAddLineButton
        onClick={() => props.onAddExtraLine!(activeTab as FinanceEntitySection)}
        title="Add expense line"
      />
    ) : undefined;

    const builtInSubtitle =
      isEntitySectionTab(activeTab) && isFinanceCalendarSection(activeTab)
        ? "Costs come from the trip calendar — set prices and per-person splits here."
        : undefined;

    return (
      <FinanceSectionSummaryRow
        label={
          isEntitySectionTab(activeTab)
            ? financeSectionExpensesLabel(activeTab, settings)
            : "Expenses"
        }
        subtitle={
          builtInSubtitle ??
          (isEntitySectionTab(activeTab)
            ? financeSectionDescription(activeTab, settings)
            : undefined)
        }
        totalCents={sectionSubtotalCents(lines)}
        pool={pool}
        participantCents={(participantId) =>
          participantTotalCents(
            lines,
            participantId,
            allocationByLine,
            pendingAllocations,
            settings,
          )
        }
        styles={gridFooterStyles()}
        formatDisplayFromBase={formatDisplayFromBase}
        leadingAction={expenseAddAction}
      />
    );
  }

  function handleUpdateFund(
    fundId: string,
    patch: {
      name?: string;
      amountCents?: number;
      allocationRulePayload?: TripFundDraft["allocationRulePayload"];
    },
  ) {
    const fund = props.costLedger.funds.find((row) => row.id === fundId);
    let nextPatch = patch;
    if (fund && isEntitySectionTab(activeTab) && isOrphanFinanceFund(fund)) {
      nextPatch = {
        ...patch,
        allocationRulePayload: {
          ...fund.allocationRulePayload,
          financeSection: activeTab,
        },
      };
    }
    props.onUpdateFund?.(fundId, nextPatch);
  }

  function gridFooterProps(
    lines: CostLineItemDraft[],
    incomeMode: FinanceGridIncomeMode,
    incomeSection: FinanceEntitySection | null = null,
    showAvgPerNight = false,
    overallView = false,
  ) {
    return {
      lines,
      ledger: props.costLedger,
      roster: props.roster,
      pool,
      allocationByLine,
      incomeSection,
      showAvgPerNight,
      overallView,
      graph: props.graph,
      presence,
      participantTotalCents: (sectionLines: CostLineItemDraft[], participantId: string) =>
        participantTotalCents(
          sectionLines,
          participantId,
          allocationByLine,
          pendingAllocations,
          settings,
        ),
      sectionSubtotalCents,
      incomeMode,
      totalColCount,
      styles: gridFooterStyles(),
      moneyCellProps,
      onAddIncomeLine: props.onAddIncomeLine,
      onUpdateFund: handleUpdateFund,
      onPatchFundParticipant: props.onPatchFundParticipant,
      onDeleteFund: props.onDeleteFund,
      onDeletePayment: props.onDeletePayment,
      selectedFundIds,
      onToggleFundSelection: toggleFundSelection,
      paymentLeadingAction:
        incomeSection && props.onAddIncomeLine ? (
          <FinanceAddLineButton
            onClick={() => props.onAddIncomeLine?.(incomeSection)}
            title="Add payment line"
          />
        ) : undefined,
      onOpenFundPricing: props.onPatchFundParticipantsBulk
        ? (fundId: string) => {
            setPricingFundId(fundId);
            setPricingError(null);
          }
        : undefined,
      fundHasPinnedPrices,
    };
  }

  function renderEmptyGridNote(message: string) {
    return (
      <tr>
        <td className={`${tdClass} ${stickyColLeft} bg-white`} />
        <td className={`${tdTextClass} ${stickyColDesc} bg-white text-zinc-500`}>
          {message}
        </td>
        <td className={`${tdClass} bg-white w-12`} />
        <td className={`${tdMoneyClass} ${moneyCol} bg-white`} />
        {pool.map((participant) => (
          <td
            key={participant.id}
            className={`${tdParticipantClass} ${participantCol} bg-white`}
          />
        ))}
        <td className={`${tdClass} bg-white w-10`} />
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
    return (
      <tr className={rowClass}>
        <td className={`${tdClass} ${stickyColLeft} ${stickyBg}`} />
        <td className={`${tdTextClass} ${stickyColDesc} ${stickyBg}`}>{label}</td>
        <td className={`${tdClass} ${stickyBg} w-12`} />
        <td className={`${tdMoneyClass} ${moneyCol} ${stickyBg} text-center`}>
          {formatDisplayFromBase(subtotal)}
        </td>
        {pool.map((participant) => {
          const sectionTotal = participantTotalCents(
            lines,
            participant.id,
            allocationByLine,
            pendingAllocations,
            settings,
          );
          return (
            <td
              key={participant.id}
              className={`${tdParticipantClass} ${participantCol} ${stickyBg} text-right`}
            >
              {sectionTotal > 0 ? formatDisplayFromBase(sectionTotal) : ""}
            </td>
          );
        })}
        <td className={`${tdClass} ${stickyBg}`} />
      </tr>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 border-b border-zinc-200 bg-white px-3 pt-2">
        <div className="flex flex-wrap items-center gap-1">
          {sectionList.map((section) => {
            const count = linesBySection.get(section)?.length ?? 0;
            const active = activeTab === section;
            const accent =
              TAB_ACCENT[section] ?? "border-rose-500 text-rose-900 bg-rose-50";
            return (
              <button
                key={section}
                type="button"
                onClick={() => {
                  setActiveTab(section);
                  setSelectedLineIds(new Set());
                  setSelectedFundIds(new Set());
                  setPricingLineId(null);
                }}
                className={[
                  "rounded-t-lg border border-b-0 px-3 py-2 text-[11px] font-semibold transition",
                  active
                    ? accent
                    : "border-transparent bg-zinc-100 text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900",
                ].join(" ")}
              >
                {financeSectionLabel(section, settings)}
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
            onClick={() => setAddSectionOpen(true)}
            className="rounded-t-lg border border-b-0 border-dashed border-zinc-300 bg-zinc-50 px-3 py-2 text-[11px] font-semibold text-zinc-600 hover:border-violet-300 hover:text-violet-700"
          >
            + Section
          </button>
          {isEntitySectionTab(activeTab) &&
          isFinanceCustomSection(activeTab, settings) &&
          props.onDeleteFinanceSection ? (
            <button
              type="button"
              onClick={() => setDeleteSectionId(activeTab)}
              className="rounded-t-lg border border-b-0 border-red-200 bg-red-50 px-3 py-2 text-[11px] font-semibold text-red-800 hover:bg-red-100"
            >
              Delete section
            </button>
          ) : null}
          <span className="mx-1 hidden h-6 w-px bg-zinc-300 sm:inline" aria-hidden />
          {(["overall", "byPerson", "byGroup"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => {
                setActiveTab(tab);
                setSelectedLineIds(new Set());
                setSelectedFundIds(new Set());
                setPricingLineId(null);
              }}
              className={[
                "rounded-t-lg border border-b-0 px-3 py-2 text-[11px] font-semibold transition",
                activeTab === tab
                  ? TAB_ACCENT[tab]
                  : "border-transparent bg-zinc-100 text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900",
              ].join(" ")}
            >
              {tab === "overall" ? "Overall" : tab === "byPerson" ? "By person" : "By group"}
            </button>
          ))}
          <div className="ml-auto flex flex-wrap items-center gap-2 pb-1">
            {!props.showEmptyLines && emptyCount > 0 ? (
              <span className="text-[10px] text-zinc-500">{emptyCount} empty hidden</span>
            ) : null}
            {isEntitySectionTab(activeTab) ? (
              <>
                <span className="text-[10px] tabular-nums text-zinc-500">
                  {pool.length} {pool.length === 1 ? "person" : "people"} in sheet
                </span>
                <span className="text-[10px] tabular-nums text-zinc-500">
                  {tabLines.length} row{tabLines.length === 1 ? "" : "s"}
                </span>
                <span className="hidden text-[10px] text-zinc-400 sm:inline">
                  drag Move to reorder
                </span>
              </>
            ) : activeTab === "overall" || activeTab === "byPerson" || activeTab === "byGroup" ? (
              <span className="text-[10px] tabular-nums text-zinc-500">
                {pool.length} {pool.length === 1 ? "person" : "people"} in sheet
              </span>
            ) : null}
            {supportsFinanceRowSelection(activeTab) && hiddenInSection.length > 0 ? (
              <div className="flex flex-wrap items-center gap-1 text-[10px] text-zinc-600">
                <span>Hidden:</span>
                {hiddenInSection.map((participant) => (
                  <button
                    key={participant.id}
                    type="button"
                    className="rounded border border-zinc-200 bg-white px-2 py-0.5 hover:border-violet-300 hover:text-violet-800"
                    onClick={() =>
                      void handleSetSectionParticipant(activeTab, participant.id, false)
                    }
                  >
                    {participant.fullName} · restore
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="relative z-20 flex shrink-0 items-center justify-center border-b border-zinc-200 bg-white px-3 py-2">
        {supportsFinanceRowSelection(activeTab) && totalSelectedCount > 0 ? (
          <button
            type="button"
            onClick={openDeleteSelected}
            className="absolute left-3 rounded border border-red-200 bg-red-50 px-2 py-1.5 text-[10px] font-medium text-red-800 hover:bg-red-100"
          >
            Delete selected ({totalSelectedCount})
          </button>
        ) : null}
        <TripOsCurrencyCalculatorHub tripId={props.tripId} />
      </div>

      {pricingError ? (
        <div className="mx-3 mb-2 flex items-start justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          <p>{pricingError}</p>
          <button
            type="button"
            onClick={() => setPricingError(null)}
            className="shrink-0 text-xs font-medium text-red-700 hover:underline"
          >
            Dismiss
          </button>
        </div>
      ) : null}

      {activeTab === "byPerson" ? (
        <FinanceByPersonView
          costLedger={props.costLedger}
          roster={props.roster}
          graph={props.graph}
          participantId={byPersonId}
          onSelectParticipant={setByPersonId}
          pendingAllocations={pendingAllocations}
        />
      ) : activeTab === "byGroup" ? (
        <FinanceByGroupView
          costLedger={props.costLedger}
          roster={props.roster}
          graph={props.graph}
          selectedGroupId={byGroupId}
          onSelectGroup={setByGroupId}
          saving={props.saving}
          pendingAllocations={pendingAllocations}
          onSaveGroups={async (groups) => {
            await props.onSaveFinanceViewGroups?.(groups);
          }}
        />
      ) : (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-zinc-100">
        {activeTab === "overall" ? (
          <div className="mb-2 shrink-0 px-3 pt-2">
            <FinanceWarningsPanel ledger={props.costLedger} />
          </div>
        ) : null}
        <div className="flex min-h-0 flex-1 flex-col px-2 pb-2 pt-1">
          <div className="finance-sheet-scroll h-fit max-h-full min-h-0 overflow-auto">
        <table className="w-max min-w-full border-collapse bg-white text-left shadow-md ring-1 ring-zinc-300">
          <thead>
            <tr>
              {isEntitySectionTab(activeTab) ? (
                <>
                  <th className={`${thClass} ${stickyHeadCorner}`} />
                  <th className={`${thClass} ${stickyHeadDesc} min-w-[14rem]`} />
                </>
              ) : (
                <>
                  <th className={`${thClass} ${stickyHeadCorner} text-center`}>
                    {supportsFinanceRowSelection(activeTab) ? (
                      <>
                        <span className="sr-only">Select rows</span>
                        <input
                          type="checkbox"
                          checked={allVisibleSelected}
                          disabled={
                            selectableLineIds.length === 0 && selectableFundIds.length === 0
                          }
                          onChange={toggleSelectAllVisible}
                          className="rounded border-zinc-400"
                          aria-label="Select all visible rows"
                        />
                      </>
                    ) : null}
                  </th>
                  <th className={`${thClass} ${stickyHeadDesc} min-w-[14rem]`} />
                </>
              )}
              <th className={`${thMoneyClass} ${stickyHeadTop} w-12 text-center`}>
                {activeTab === "accommodation" ? "Nights" : "Qty"}
              </th>
              <th className={`${thMoneyClass} ${stickyHeadTop} ${moneyCol} text-center`}>
                Total
              </th>
              {pool.map((participant) => {
                const label = participantHeaderLabel(participant, pool);
                const sectionLabel = isEntitySectionTab(activeTab)
                  ? financeSectionLabel(activeTab, settings)
                  : undefined;
                return (
                  <th
                    key={participant.id}
                    className={`${thParticipantHeadClass} ${stickyHeadParticipant} ${participantCol} text-center`}
                  >
                    <FinanceParticipantHeader
                      label={label}
                      fullName={participant.fullName}
                      sectionLabel={sectionLabel}
                      onRemoveFromSection={
                        isEntitySectionTab(activeTab)
                          ? () =>
                              void handleSetSectionParticipant(activeTab, participant.id, true)
                          : undefined
                      }
                      onRemoveFromFinance={() =>
                        void props.onRemoveFromFinance?.(participant.id)
                      }
                    />
                  </th>
                );
              })}
              {!showRailStatus ? (
                <th className={`${thMoneyClass} ${stickyHeadTop} w-10 text-center`}>✓</th>
              ) : null}
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
                {sectionList.map((section) => {
                  const lines = linesBySection.get(section) ?? [];
                  if (!lines.length) return null;
                  return (
                    <Fragment key={section}>
                      {renderSubtotalRow(financeSectionLabel(section, settings), lines, "hover:bg-zinc-50/80")}
                    </Fragment>
                  );
                })}
                {visibleLines.length === 0
                  ? renderEmptyGridNote(
                      emptyCount > 0 && !props.showEmptyLines
                        ? "Linked calendar rows are hidden. Turn on Show empty to see and price them."
                        : "Add on the trip calendar — it will appear here automatically.",
                    )
                  : null}
                <FinanceGridFooter
                  {...gridFooterProps(visibleLines, "full", null, false, true)}
                />
              </>
            ) : tabLines.length === 0 ? (
              <>
                {isEntitySectionTab(activeTab) ? renderExpensesSummaryRow([]) : null}
                {isEntitySectionTab(activeTab) ? (
                  renderEmptyGridNote(
                    financeCalendarEmptyNote({
                      section: activeTab,
                      hiddenWithAmounts: emptyCount > 0 && !props.showEmptyLines,
                      manualSection: supportsManualExpenseLines(activeTab),
                    }),
                  )
                ) : (
                  <tr>
                    <td
                      colSpan={totalColCount}
                      className="border border-zinc-300 px-4 py-8 text-center text-[11px] text-zinc-500"
                    >
                      No rows in this view yet.
                    </td>
                  </tr>
                )}
                {isEntitySectionTab(activeTab) ? (
                  <FinanceGridFooter
                    {...gridFooterProps(
                      [],
                      "placeholder",
                      activeTab,
                      activeTab === "accommodation",
                    )}
                  />
                ) : null}
              </>
            ) : (
              <>
                {isEntitySectionTab(activeTab) ? renderExpensesSummaryRow(tabLines) : null}
                {tabLines.map((line, index) => renderLineRow(line, index + 1))}
                {isEntitySectionTab(activeTab) ? (
                  <FinanceGridFooter
                    {...gridFooterProps(
                      tabLines,
                      "placeholder",
                      activeTab,
                      activeTab === "accommodation",
                    )}
                  />
                ) : null}
              </>
            )}
          </tbody>
        </table>
          </div>
        </div>
      </div>
      )}

      {pendingDeleteLines?.length ? (
        <FinanceDeleteModal
          lines={pendingDeleteLines}
          onCancel={() => {
            setPendingDeleteLines(null);
            setPendingDeleteFundIds([]);
          }}
          onFinanceOnly={async () => {
            const lines = pendingDeleteLines;
            const fundIds = pendingDeleteFundIds;
            setPendingDeleteLines(null);
            setPendingDeleteFundIds([]);
            if (!lines?.length) return;
            await confirmFinanceOnlyDelete(lines);
            if (fundIds.length) await deleteSelectedFunds(fundIds);
          }}
          onRemoveFromTrip={async () => {
            const lines = pendingDeleteLines;
            const fundIds = pendingDeleteFundIds;
            setPendingDeleteLines(null);
            setPendingDeleteFundIds([]);
            if (!lines?.length) return;
            await confirmRemoveFromTrip(lines);
            if (fundIds.length) await deleteSelectedFunds(fundIds);
          }}
        />
      ) : null}

      {pricingLine && props.onPatchParticipantsBulk ? (
        <FinancePerPersonPricesModal
          open={pricingLineId != null}
          lineId={pricingLine.id}
          lineDescription={pricingLine.description}
          linkedHint={linkedLegHint(pricingLine)}
          currency={pricingLine.currency}
          participants={pricingParticipants}
          applyError={pricingError}
          onCancel={() => {
            setPricingLineId(null);
            setPricingError(null);
          }}
          onApply={applyPerPersonPrices}
        />
      ) : null}

      {pricingFund && props.onPatchFundParticipantsBulk ? (
        <FinancePerPersonPricesModal
          open={pricingFundId != null}
          lineId={pricingFund.id}
          lineDescription={pricingFund.name.trim() || "New line"}
          currency={pricingFund.currency}
          participants={pricingFundParticipants}
          applyError={pricingError}
          onCancel={() => {
            setPricingFundId(null);
            setPricingError(null);
          }}
          onApply={applyPerPersonFundPrices}
        />
      ) : null}

      <FinanceAddSectionModal
        open={addSectionOpen}
        saving={props.saving}
        onCancel={() => setAddSectionOpen(false)}
        onAdd={async (name, description) => {
          const ok = (await props.onAddFinanceSection?.(name, description)) ?? false;
          if (ok) setAddSectionOpen(false);
        }}
      />

      {deleteSectionTarget ? (
        <FinanceDeleteSectionModal
          open={deleteSectionId != null}
          sectionName={deleteSectionTarget.name}
          lineCount={deleteSectionTarget.lineCount}
          fundCount={deleteSectionTarget.fundCount}
          saving={props.saving}
          onCancel={() => setDeleteSectionId(null)}
          onConfirm={async () => {
            const sectionId = deleteSectionTarget.id;
            const ok = (await props.onDeleteFinanceSection?.(sectionId)) ?? false;
            if (!ok) return;
            setDeleteSectionId(null);
            if (activeTab === sectionId) {
              setActiveTab("other");
            }
          }}
        />
      ) : null}
    </div>
  );
}
