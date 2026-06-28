"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { FinanceExportModal } from "../finance/FinanceExportModal";
import { FinanceSpreadsheet } from "../finance/FinanceSpreadsheet";
import {
  TripOsCurrencyHubProvider,
  useTripOsCurrencyHub,
} from "../currency/TripOsCurrencyHubContext";
import { emptyCostLedgerProjection } from "@/lib/trip-engine/cost-ledger/empty-projection";
import type { CostLedgerProjection } from "@/lib/trip-engine/cost-ledger/types";
import type { RosterSummary, TripEntityGraph } from "@/lib/trip-engine/types";
import type { FinanceBuiltInSection, FinanceEntitySection } from "@/lib/trip-engine/cost-ledger/finance-sections";
import type { FinanceViewGroup } from "@/lib/trip-engine/cost-ledger/types";

import type { CostsPatchResult } from "../useTripOsEngine";
import { hostJson } from "@/components/host/shared/host-fetch";
import { extraLinePayload, patchBulkParticipantAllocations, patchLinePayload, patchParticipantAllocation, type FinanceLinePatch } from "../finance/finance-line-patch";
import { patchBulkFundAllocations, patchFundParticipantAllocation } from "../finance/finance-fund-patch";
import type { CostLineFormValues } from "../costs/CostLineDrawer";

type FinanceAction =
  | { action: "updateSettings"; settings: Record<string, unknown> }
  | { action: "addLine"; line: Record<string, unknown> }
  | { action: "updateLine"; lineId: string; line: Record<string, unknown> }
  | { action: "deleteLine"; lineId: string }
  | { action: "dismissAndDeleteLine"; lineId: string }
  | { action: "removeLineFromTrip"; lineId: string }
  | {
      action: "deleteLines";
      lineIds: string[];
      mode: "financeOnly" | "removeFromTrip";
    }
  | {
      action: "reorderSectionLines";
      section: FinanceEntitySection;
      orderedIds: string[];
    }
  | { action: "deleteEmptyLines" }
  | { action: "addFinanceSection"; name: string; description?: string }
  | { action: "deleteFinanceSection"; sectionId: string }
  | { action: "updateFinanceViewGroups"; groups: FinanceViewGroup[] }
  | {
      action: "setFinanceSectionParticipant";
      section: FinanceEntitySection;
      participantId: string;
      excluded: boolean;
    }
  | { action: "addFund"; fund: Record<string, unknown> }
  | { action: "updateFund"; fundId: string; fund: Record<string, unknown> }
  | { action: "deleteFund"; fundId: string }
  | { action: "deleteFunds"; fundIds: string[] }
  | { action: "addPayment"; payment: Record<string, unknown> }
  | { action: "deletePayment"; paymentId: string }
  | { action: "addSupplierPayment"; supplierPayment: Record<string, unknown> }
  | { action: "deleteSupplierPayment"; supplierPaymentId: string };

export function FinanceSection(props: {
  tripId: string;
  inviteCode: string;
  roster: RosterSummary;
  graph?: TripEntityGraph | null;
  costLedger: CostLedgerProjection | null;
  onFinanceAction: (payload: FinanceAction) => Promise<CostsPatchResult>;
  resolveFinanceLineId?: (lineId: string) => string;
  onRosterChanged?: () => void;
  saving?: boolean;
  focusSectionTab?: FinanceBuiltInSection | null;
  focusLineId?: string | null;
  onFocusConsumed?: () => void;
}) {
  const ledger = props.costLedger;
  const settings = ledger?.settings ?? {
    baseCurrency: "NZD",
    foreignCurrency: null,
    exchangeRate: null,
    exchangeRateDate: null,
    exchangeRateManual: false,
    financeCustomSections: [],
    financeViewGroups: [],
    financeSectionExclusions: {},
  };

  const onPersistRate = useCallback(
    (patch: {
      foreignCurrency: string | null;
      exchangeRate: number | null;
      exchangeRateDate: string | null;
      exchangeRateManual: boolean;
    }) => {
      void props.onFinanceAction({
        action: "updateSettings",
        settings: { ...settings, ...patch },
      });
    },
    [props.onFinanceAction, settings],
  );

  return (
    <TripOsCurrencyHubProvider
      tripId={props.tripId}
      baseCurrency={settings.baseCurrency}
      initialDisplayCurrency={settings.foreignCurrency ?? settings.baseCurrency}
      onPersistRate={onPersistRate}
    >
      <FinanceSectionBody {...props} settings={settings} />
    </TripOsCurrencyHubProvider>
  );
}

function FinanceSectionBody(props: {
  tripId: string;
  inviteCode: string;
  roster: RosterSummary;
  graph?: TripEntityGraph | null;
  costLedger: CostLedgerProjection | null;
  onFinanceAction: (payload: FinanceAction) => Promise<CostsPatchResult>;
  resolveFinanceLineId?: (lineId: string) => string;
  onRosterChanged?: () => void;
  saving?: boolean;
  focusSectionTab?: FinanceBuiltInSection | null;
  focusLineId?: string | null;
  onFocusConsumed?: () => void;
  settings: NonNullable<CostLedgerProjection["settings"]>;
}) {
  const currencyHub = useTripOsCurrencyHub();
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [showEmptyLines, setShowEmptyLines] = useState(true);
  const displayCurrency = currencyHub.displayCurrency;
  const exchangeRates = currencyHub.exchangeRates;

  const tripName = props.graph?.basics?.name?.trim() || "Trip";

  const settings = props.settings;
  const ledger = props.costLedger;

  const costSplitParticipants = useMemo(
    () => props.roster.participants.filter((p) => p.inCostSplit && p.role !== "host"),
    [props.roster.participants],
  );

  const ledgerForGrid =
    props.costLedger ??
    emptyCostLedgerProjection({
      baseCurrency: settings.baseCurrency,
      foreignCurrency: settings.foreignCurrency,
      exchangeRate: settings.exchangeRate,
      exchangeRateDate: settings.exchangeRateDate,
      exchangeRateManual: settings.exchangeRateManual,
    });

  const emptyLineCount = useMemo(
    () => ledger?.lineItems.filter((l) => l.totalAmountCents === 0).length ?? 0,
    [ledger?.lineItems],
  );

  const hasRoster = costSplitParticipants.length > 0;

  useEffect(() => {
    currencyHub.setDisplayCurrency(settings.foreignCurrency ?? settings.baseCurrency);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync when ledger settings load
  }, [settings.baseCurrency, settings.foreignCurrency]);

  async function addExtraLine(section: FinanceEntitySection) {
    await props.onFinanceAction({
      action: "addLine",
      line: extraLinePayload(section, settings.baseCurrency),
    });
  }

  async function reorderSectionLines(section: FinanceEntitySection, orderedIds: string[]) {
    await props.onFinanceAction({
      action: "reorderSectionLines",
      section,
      orderedIds,
    });
  }

  async function patchParticipant(
    lineId: string,
    participantId: string,
    amountCents: number | null,
  ) {
    const line = ledgerForGrid.lineItems.find((l) => l.id === lineId);
    const lineAlloc = ledgerForGrid.lineAllocations.find((l) => l.lineItemId === lineId);
    if (!line || !lineAlloc) return;
    await props.onFinanceAction({
      action: "updateLine",
      lineId,
      line: patchParticipantAllocation(line, lineAlloc, participantId, amountCents),
    });
  }

  async function patchParticipantsBulk(
    lineId: string,
    updates: { participantId: string; amountCents: number }[],
  ): Promise<CostsPatchResult> {
    const resolvedId = props.resolveFinanceLineId?.(lineId) ?? lineId;
    const line =
      ledgerForGrid.lineItems.find((l) => l.id === lineId) ??
      ledgerForGrid.lineItems.find((l) => l.id === resolvedId);
    const lineAlloc =
      ledgerForGrid.lineAllocations.find((l) => l.lineItemId === lineId) ??
      ledgerForGrid.lineAllocations.find((l) => l.lineItemId === resolvedId);
    if (!line || !lineAlloc || updates.length === 0) {
      return { ok: false, error: "Could not find this finance row." };
    }
    return props.onFinanceAction({
      action: "updateLine",
      lineId: resolvedId,
      line: patchBulkParticipantAllocations(line, lineAlloc, updates, {
        replacePins: true,
        syncTotalToPins: true,
      }),
    });
  }

  async function patchFundParticipant(
    fundId: string,
    participantId: string,
    amountCents: number | null,
  ) {
    const fund = ledgerForGrid.funds.find((row) => row.id === fundId);
    if (!fund) return;
    await props.onFinanceAction({
      action: "updateFund",
      fundId,
      fund: patchFundParticipantAllocation(fund, participantId, amountCents),
    });
  }

  async function patchFundParticipantsBulk(
    fundId: string,
    updates: { participantId: string; amountCents: number }[],
  ): Promise<CostsPatchResult> {
    const fund = ledgerForGrid.funds.find((row) => row.id === fundId);
    if (!fund || updates.length === 0) {
      return { ok: false, error: "Could not find this payment row." };
    }
    return props.onFinanceAction({
      action: "updateFund",
      fundId,
      fund: patchBulkFundAllocations(fund, updates),
    });
  }

  async function patchLine(lineId: string, patch: FinanceLinePatch) {
    const resolvedId = props.resolveFinanceLineId?.(lineId) ?? lineId;
    const line =
      ledgerForGrid.lineItems.find((l) => l.id === lineId) ??
      ledgerForGrid.lineItems.find((l) => l.id === resolvedId);
    if (!line) return;
    await props.onFinanceAction({
      action: "updateLine",
      lineId: resolvedId,
      line: patchLinePayload(line, patch),
    });
  }

  async function clearEmptyLines() {
    if (emptyLineCount === 0) return;
    if (!confirm(`Remove ${emptyLineCount} empty row${emptyLineCount === 1 ? "" : "s"}?`)) return;
    await props.onFinanceAction({ action: "deleteEmptyLines" });
  }

  const hostParticipantsApi = `/api/host/${encodeURIComponent(props.inviteCode)}/participants`;

  async function setSectionParticipant(
    section: FinanceEntitySection,
    participantId: string,
    excluded: boolean,
  ) {
    await props.onFinanceAction({
      action: "setFinanceSectionParticipant",
      section,
      participantId,
      excluded,
    });
  }

  async function removeFromFinance(participantId: string) {
    const participant = props.roster.participants.find((p) => p.id === participantId);
    if (!participant) return;
    if (
      !confirm(
        `Remove ${participant.fullName} from the entire cost split? They won't appear on any finance tab.`,
      )
    ) {
      return;
    }
    await hostJson(`${hostParticipantsApi}/${participantId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ inCostSplit: false }),
    });
    props.onRosterChanged?.();
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-white">
      <header className="shrink-0 border-b border-zinc-200 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-base font-semibold text-zinc-900">Finance</h1>
            <p className="text-[11px] text-zinc-500">
              {costSplitParticipants.length} people as columns
              {props.saving ? " · saving…" : ""}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            <ToolbarButton onClick={() => setExportModalOpen(true)}>
              Export report
            </ToolbarButton>
            {emptyLineCount > 0 ? (
              <>
                <ToolbarButton onClick={() => setShowEmptyLines((v) => !v)}>
                  {showEmptyLines ? "Hide" : "Show"} empty ({emptyLineCount})
                </ToolbarButton>
                <ToolbarButton onClick={() => void clearEmptyLines()} danger>
                  Clear empty
                </ToolbarButton>
              </>
            ) : null}
          </div>
        </div>

        {!hasRoster ? (
          <p className="mt-2 text-xs text-amber-700">
            Add participants in Users — they become columns in this sheet.
          </p>
        ) : null}
      </header>

      <div className="flex min-h-0 flex-1 flex-col">
        {hasRoster ? (
          <FinanceSpreadsheet
            tripId={props.tripId}
            costLedger={ledgerForGrid}
            roster={props.roster}
            graph={props.graph}
            focusSectionTab={props.focusSectionTab ?? null}
            focusLineId={props.focusLineId ?? null}
            onFocusConsumed={props.onFocusConsumed}
            showEmptyLines={showEmptyLines}
            displayCurrency={displayCurrency}
            exchangeRates={exchangeRates}
            onPatchLine={(lineId, patch) => void patchLine(lineId, patch)}
            onPatchParticipant={(lineId, participantId, amountCents) =>
              void patchParticipant(lineId, participantId, amountCents)
            }
            onPatchParticipantsBulk={(lineId, allocations) =>
              patchParticipantsBulk(lineId, allocations)
            }
            onPatchFundParticipantsBulk={(fundId, allocations) =>
              patchFundParticipantsBulk(fundId, allocations)
            }
            onPatchFundParticipant={(fundId, participantId, amountCents) =>
              void patchFundParticipant(fundId, participantId, amountCents)
            }
            onDismissLine={async (lineId) => {
              await props.onFinanceAction({ action: "dismissAndDeleteLine", lineId });
            }}
            onDeleteLine={async (lineId) => {
              await props.onFinanceAction({ action: "deleteLine", lineId });
            }}
            onRemoveLineFromTrip={async (lineId) => {
              await props.onFinanceAction({ action: "removeLineFromTrip", lineId });
            }}
            onDeleteLines={async (lineIds, mode) => {
              await props.onFinanceAction({ action: "deleteLines", lineIds, mode });
            }}
            onAddExtraLine={(section) => void addExtraLine(section)}
            onReorderSectionLines={(section, orderedIds) =>
              void reorderSectionLines(section, orderedIds)
            }
            onAddFinanceSection={async (name, description) => {
              const result = await props.onFinanceAction({
                action: "addFinanceSection",
                name,
                description,
              });
              return result.ok;
            }}
            onDeleteFinanceSection={async (sectionId) => {
              const result = await props.onFinanceAction({
                action: "deleteFinanceSection",
                sectionId,
              });
              return result.ok;
            }}
            onSaveFinanceViewGroups={async (groups) => {
              const result = await props.onFinanceAction({
                action: "updateFinanceViewGroups",
                groups,
              });
              return result.ok;
            }}
            onSetSectionParticipant={(section, participantId, excluded) =>
              setSectionParticipant(section, participantId, excluded)
            }
            onRemoveFromFinance={(participantId) => removeFromFinance(participantId)}
            onAddIncomeLine={(section) =>
              props.onFinanceAction({
                action: "addFund",
                fund: {
                  name: "New line",
                  amountCents: 0,
                  currency: settings.baseCurrency,
                  allocationRuleType: "equal_cost_participants",
                  allocationRulePayload: section ? { financeSection: section } : {},
                },
              })
            }
            onUpdateFund={(fundId, patch) =>
              void props.onFinanceAction({ action: "updateFund", fundId, fund: patch })
            }
            onDeleteFund={(fundId) => props.onFinanceAction({ action: "deleteFund", fundId })}
            onDeleteFunds={(fundIds) =>
              props.onFinanceAction({ action: "deleteFunds", fundIds })
            }
            onDeletePayment={(paymentId) =>
              void props.onFinanceAction({ action: "deletePayment", paymentId })
            }
            saving={props.saving}
          />
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-zinc-500">
            Add participants in Users — they become columns in this sheet.
          </div>
        )}
      </div>

      <FinanceExportModal
        open={exportModalOpen}
        exportContext={{
          ledger: ledgerForGrid,
          roster: props.roster,
          tripName,
          graph: props.graph,
        }}
        onClose={() => setExportModalOpen(false)}
      />
    </div>
  );
}

function ToolbarButton(props: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
  danger?: boolean;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      disabled={props.disabled}
      className={[
        "rounded border px-2.5 py-1 text-[11px] font-medium disabled:opacity-50",
        props.primary
          ? "border-violet-700 bg-violet-600 text-white hover:bg-violet-700"
          : props.danger
            ? "border-red-200 bg-white text-red-600 hover:bg-red-50"
            : props.active
              ? "border-violet-400 bg-violet-50 text-violet-800 shadow-sm shadow-violet-100"
              : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50",
      ].join(" ")}
    >
      {props.children}
    </button>
  );
}
