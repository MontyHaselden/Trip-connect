"use client";

import { useMemo, useState } from "react";

import { downloadFinancePack } from "@/lib/trip-engine/cost-ledger/export-finance-csv";
import { emptyCostLedgerProjection } from "@/lib/trip-engine/cost-ledger/empty-projection";
import type { CostLedgerProjection } from "@/lib/trip-engine/cost-ledger/types";
import { formatMoney, parseMoneyInput } from "@/lib/trip-engine/cost-ledger/format-money";
import {
  PAID_BY_TYPE_LABELS,
  PAID_BY_TYPES,
  SUPPLIER_PAYMENT_METHOD_LABELS,
  SUPPLIER_PAYMENT_METHODS,
} from "@/lib/trip-engine/cost-ledger/finance-metadata";
import type { PaidByType, SupplierPaymentMethod } from "@/lib/trip-engine/cost-ledger/finance-metadata";
import type { RosterSummary, TripEntityGraph } from "@/lib/trip-engine/types";
import type { CostLineItemDraft } from "@/lib/trip-engine/cost-ledger/types";
import type { FinanceEntitySection } from "@/lib/trip-engine/cost-ledger/finance-sections";

import { FinanceSpreadsheet } from "../finance/FinanceSpreadsheet";
import { FinanceRowDetailPanel } from "../finance/FinanceRowDetailPanel";
import { extraLinePayload, patchLinePayload, patchParticipantAllocation } from "../finance/finance-line-patch";
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
  | { action: "addFund"; fund: Record<string, unknown> }
  | { action: "deleteFund"; fundId: string }
  | { action: "addPayment"; payment: Record<string, unknown> }
  | { action: "deletePayment"; paymentId: string }
  | { action: "addSupplierPayment"; supplierPayment: Record<string, unknown> }
  | { action: "deleteSupplierPayment"; supplierPaymentId: string };

export function FinanceSection(props: {
  roster: RosterSummary;
  graph?: TripEntityGraph | null;
  costLedger: CostLedgerProjection | null;
  onFinanceAction: (payload: FinanceAction) => Promise<boolean>;
  saving?: boolean;
}) {
  const [detailLineId, setDetailLineId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showEmptyLines, setShowEmptyLines] = useState(true);
  const [bottomTab, setBottomTab] = useState<"funds" | "payments" | "supplier">("funds");
  const [fundName, setFundName] = useState("");
  const [fundAmount, setFundAmount] = useState("");
  const [paymentParticipantId, setPaymentParticipantId] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentLabel, setPaymentLabel] = useState("deposit");
  const [supplierPaidTo, setSupplierPaidTo] = useState("");
  const [supplierAmount, setSupplierAmount] = useState("");
  const [supplierLineId, setSupplierLineId] = useState("");
  const [supplierPaidByType, setSupplierPaidByType] = useState<PaidByType>("school_bank");
  const [supplierPaymentMethod, setSupplierPaymentMethod] =
    useState<SupplierPaymentMethod>("bank_transfer");

  const tripName = props.graph?.basics?.name?.trim() || "Trip";

  const ledger = props.costLedger;
  const settings = ledger?.settings ?? {
    baseCurrency: "NZD",
    foreignCurrency: null,
    exchangeRate: null,
    exchangeRateDate: null,
    exchangeRateManual: false,
  };

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

  async function patchLine(lineId: string, patch: Partial<CostLineFormValues>) {
    const line = ledgerForGrid.lineItems.find((l) => l.id === lineId);
    if (!line) return;
    await props.onFinanceAction({
      action: "updateLine",
      lineId,
      line: patchLinePayload(line, patch),
    });
  }

  const detailLine = detailLineId
    ? ledgerForGrid.lineItems.find((l) => l.id === detailLineId)
    : null;

  async function saveLineDetails(lineId: string, patch: Record<string, unknown>) {
    await props.onFinanceAction({ action: "updateLine", lineId, line: patch });
  }

  async function clearEmptyLines() {
    if (emptyLineCount === 0) return;
    if (!confirm(`Remove ${emptyLineCount} empty row${emptyLineCount === 1 ? "" : "s"}?`)) return;
    await props.onFinanceAction({ action: "deleteEmptyLines" });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-white">
      <header className="shrink-0 border-b border-zinc-200 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-base font-semibold text-zinc-900">Finance</h1>
            <p className="text-[11px] text-zinc-500">
              {costSplitParticipants.length} people as columns
              {props.saving ? " · saving…" : ""}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <ToolbarButton onClick={() => setShowSettings((v) => !v)}>Currency</ToolbarButton>
            <ToolbarButton
              onClick={() =>
                downloadFinancePack({
                  ledger: ledgerForGrid,
                  roster: props.roster,
                  tripName,
                  graph: props.graph,
                })
              }
            >
              Export pack
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

        {showSettings ? (
          <div className="mt-3 rounded border border-zinc-300 bg-zinc-50 p-3">
            <CurrencySettingsForm
              settings={settings}
              saving={props.saving}
              onSave={(patch) =>
                props.onFinanceAction({ action: "updateSettings", settings: patch })
              }
            />
          </div>
        ) : null}
      </header>

      <div className="flex min-h-0 flex-1 flex-col">
        {hasRoster ? (
          <FinanceSpreadsheet
            costLedger={ledgerForGrid}
            roster={props.roster}
            graph={props.graph}
            showEmptyLines={showEmptyLines}
            onPatchLine={(lineId, patch) => void patchLine(lineId, patch)}
            onPatchParticipant={(lineId, participantId, amountCents) =>
              void patchParticipant(lineId, participantId, amountCents)
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
            detailLineId={detailLineId}
            onOpenLineDetail={setDetailLineId}
          />
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-zinc-500">
            Add participants in Users — they become columns in this sheet.
          </div>
        )}
      </div>

      <footer className="shrink-0 border-t border-zinc-300 bg-zinc-50">
        <div className="flex border-b border-zinc-200">
          {(
            [
              ["funds", "Funds in"],
              ["payments", "Parent payments"],
              ["supplier", "Supplier payouts"],
            ] as const
          ).map(([tab, label]) => (
            <button
              key={tab}
              type="button"
              onClick={() => setBottomTab(tab)}
              className={[
                "px-4 py-2 text-[11px] font-medium",
                bottomTab === tab
                  ? "border-b-2 border-violet-600 bg-white text-zinc-900"
                  : "text-zinc-500 hover:text-zinc-800",
              ].join(" ")}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="max-h-40 overflow-auto p-3">
          {bottomTab === "funds" ? (
            <FundsPanel
              ledger={ledger}
              fundName={fundName}
              fundAmount={fundAmount}
              onFundName={setFundName}
              onFundAmount={setFundAmount}
              onAdd={async () => {
                const amountCents = parseMoneyInput(fundAmount);
                if (!fundName.trim() || amountCents <= 0) return;
                await props.onFinanceAction({
                  action: "addFund",
                  fund: {
                    name: fundName.trim(),
                    amountCents,
                    currency: settings.baseCurrency,
                    allocationRuleType: "equal_cost_participants",
                    allocationRulePayload: {},
                  },
                });
                setFundName("");
                setFundAmount("");
              }}
              onDelete={(id) => props.onFinanceAction({ action: "deleteFund", fundId: id })}
            />
          ) : bottomTab === "payments" ? (
            <PaymentsPanel
              ledger={ledger}
              roster={props.roster}
              participants={costSplitParticipants}
              paymentParticipantId={paymentParticipantId}
              paymentAmount={paymentAmount}
              paymentLabel={paymentLabel}
              onParticipant={setPaymentParticipantId}
              onAmount={setPaymentAmount}
              onLabel={setPaymentLabel}
              onRecord={async () => {
                const amountCents = parseMoneyInput(paymentAmount);
                if (!paymentParticipantId || amountCents <= 0) return;
                await props.onFinanceAction({
                  action: "addPayment",
                  payment: {
                    participantId: paymentParticipantId,
                    amountCents,
                    currency: settings.baseCurrency,
                    paidAt: new Date().toISOString().slice(0, 10),
                    label: paymentLabel,
                  },
                });
                setPaymentAmount("");
              }}
              onDelete={(id) => props.onFinanceAction({ action: "deletePayment", paymentId: id })}
            />
          ) : (
            <SupplierPaymentsPanel
              ledger={ledger}
              lines={ledgerForGrid.lineItems}
              paidTo={supplierPaidTo}
              amount={supplierAmount}
              lineId={supplierLineId}
              paidByType={supplierPaidByType}
              paymentMethod={supplierPaymentMethod}
              currency={settings.baseCurrency}
              onPaidTo={setSupplierPaidTo}
              onAmount={setSupplierAmount}
              onLineId={setSupplierLineId}
              onPaidByType={setSupplierPaidByType}
              onPaymentMethod={setSupplierPaymentMethod}
              onAdd={async () => {
                const amountCents = parseMoneyInput(supplierAmount);
                if (amountCents <= 0) return;
                await props.onFinanceAction({
                  action: "addSupplierPayment",
                  supplierPayment: {
                    costLineItemId: supplierLineId || null,
                    paidAt: new Date().toISOString().slice(0, 10),
                    paidByType: supplierPaidByType,
                    paidTo: supplierPaidTo.trim() || null,
                    amountCents,
                    currency: settings.baseCurrency,
                    paymentMethod: supplierPaymentMethod,
                  },
                });
                setSupplierAmount("");
              }}
              onDelete={(id) =>
                props.onFinanceAction({ action: "deleteSupplierPayment", supplierPaymentId: id })
              }
            />
          )}
        </div>
      </footer>

      {detailLine ? (
        <FinanceRowDetailPanel
          line={detailLine}
          ledger={ledgerForGrid}
          open
          onClose={() => setDetailLineId(null)}
          onSave={saveLineDetails}
        />
      ) : null}
    </div>
  );
}

function ToolbarButton(props: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
  danger?: boolean;
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
            : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50",
      ].join(" ")}
    >
      {props.children}
    </button>
  );
}

function FundsPanel(props: {
  ledger: CostLedgerProjection | null;
  fundName: string;
  fundAmount: string;
  onFundName: (v: string) => void;
  onFundAmount: (v: string) => void;
  onAdd: () => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <input
          value={props.fundName}
          onChange={(e) => props.onFundName(e.target.value)}
          placeholder="Fund name"
          className="min-w-[10rem] flex-1 rounded border border-zinc-300 px-2 py-1 text-[11px]"
        />
        <input
          value={props.fundAmount}
          onChange={(e) => props.onFundAmount(e.target.value)}
          placeholder="Amount"
          className="w-24 rounded border border-zinc-300 px-2 py-1 text-[11px]"
        />
        <button
          type="button"
          onClick={() => void props.onAdd()}
          className="rounded border border-zinc-300 bg-white px-2 py-1 text-[11px] font-medium hover:bg-zinc-50"
        >
          Add fund
        </button>
      </div>
      {props.ledger?.funds.length ? (
        <table className="w-full border-collapse text-[11px]">
          <tbody>
            {props.ledger.funds.map((f) => (
              <tr key={f.id}>
                <td className="border border-zinc-300 px-2 py-1">{f.name}</td>
                <td className="border border-zinc-300 px-2 py-1 tabular-nums">
                  {formatMoney(f.amountCents, f.currency)}
                </td>
                <td className="border border-zinc-300 px-2 py-1">
                  <button
                    type="button"
                    onClick={() => void props.onDelete(f.id)}
                    className="text-red-500 hover:underline"
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="text-[11px] text-zinc-500">Council grants, marketing credits, etc.</p>
      )}
    </div>
  );
}

function PaymentsPanel(props: {
  ledger: CostLedgerProjection | null;
  roster: RosterSummary;
  participants: RosterSummary["participants"];
  paymentParticipantId: string;
  paymentAmount: string;
  paymentLabel: string;
  onParticipant: (v: string) => void;
  onAmount: (v: string) => void;
  onLabel: (v: string) => void;
  onRecord: () => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <select
          value={props.paymentParticipantId}
          onChange={(e) => props.onParticipant(e.target.value)}
          className="rounded border border-zinc-300 px-2 py-1 text-[11px]"
        >
          <option value="">Person…</option>
          {props.participants.map((p) => (
            <option key={p.id} value={p.id}>
              {p.fullName}
            </option>
          ))}
        </select>
        <input
          value={props.paymentAmount}
          onChange={(e) => props.onAmount(e.target.value)}
          placeholder="Amount"
          className="w-24 rounded border border-zinc-300 px-2 py-1 text-[11px]"
        />
        <input
          value={props.paymentLabel}
          onChange={(e) => props.onLabel(e.target.value)}
          placeholder="Label"
          className="w-24 rounded border border-zinc-300 px-2 py-1 text-[11px]"
        />
        <button
          type="button"
          onClick={() => void props.onRecord()}
          className="rounded border border-zinc-300 bg-white px-2 py-1 text-[11px] font-medium hover:bg-zinc-50"
        >
          Record
        </button>
      </div>
      {props.ledger?.payments.length ? (
        <table className="w-full border-collapse text-[11px]">
          <tbody>
            {props.ledger.payments.map((pay) => {
              const person = props.roster.participants.find((p) => p.id === pay.participantId);
              return (
                <tr key={pay.id}>
                  <td className="border border-zinc-300 px-2 py-1">
                    {person?.fullName ?? "Unknown"} · {pay.label} · {pay.paidAt}
                  </td>
                  <td className="border border-zinc-300 px-2 py-1 tabular-nums">
                    {formatMoney(pay.amountCents, pay.currency)}
                  </td>
                  <td className="border border-zinc-300 px-2 py-1">
                    <button
                      type="button"
                      onClick={() => void props.onDelete(pay.id)}
                      className="text-red-500 hover:underline"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : null}
    </div>
  );
}

function SupplierPaymentsPanel(props: {
  ledger: CostLedgerProjection | null;
  lines: CostLineItemDraft[];
  paidTo: string;
  amount: string;
  lineId: string;
  paidByType: PaidByType;
  paymentMethod: SupplierPaymentMethod;
  currency: string;
  onPaidTo: (v: string) => void;
  onAmount: (v: string) => void;
  onLineId: (v: string) => void;
  onPaidByType: (v: PaidByType) => void;
  onPaymentMethod: (v: SupplierPaymentMethod) => void;
  onAdd: () => void;
  onDelete: (id: string) => void;
}) {
  const lineById = new Map(props.lines.map((l) => [l.id, l.description]));
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <select
          value={props.lineId}
          onChange={(e) => props.onLineId(e.target.value)}
          className="min-w-[8rem] rounded border border-zinc-300 px-2 py-1 text-[11px]"
        >
          <option value="">Link to row…</option>
          {props.lines.map((line) => (
            <option key={line.id} value={line.id}>
              {line.description}
            </option>
          ))}
        </select>
        <input
          value={props.paidTo}
          onChange={(e) => props.onPaidTo(e.target.value)}
          placeholder="Paid to / supplier"
          className="min-w-[8rem] flex-1 rounded border border-zinc-300 px-2 py-1 text-[11px]"
        />
        <input
          value={props.amount}
          onChange={(e) => props.onAmount(e.target.value)}
          placeholder="Amount"
          className="w-24 rounded border border-zinc-300 px-2 py-1 text-[11px]"
        />
        <select
          value={props.paidByType}
          onChange={(e) => props.onPaidByType(e.target.value as PaidByType)}
          className="rounded border border-zinc-300 px-2 py-1 text-[11px]"
        >
          {PAID_BY_TYPES.map((t) => (
            <option key={t} value={t}>
              {PAID_BY_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
        <select
          value={props.paymentMethod}
          onChange={(e) => props.onPaymentMethod(e.target.value as SupplierPaymentMethod)}
          className="rounded border border-zinc-300 px-2 py-1 text-[11px]"
        >
          {SUPPLIER_PAYMENT_METHODS.map((m) => (
            <option key={m} value={m}>
              {SUPPLIER_PAYMENT_METHOD_LABELS[m]}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => void props.onAdd()}
          className="rounded border border-zinc-300 bg-white px-2 py-1 text-[11px] font-medium hover:bg-zinc-50"
        >
          Record payout
        </button>
      </div>
      {props.ledger?.supplierPayments.length ? (
        <table className="w-full border-collapse text-[11px]">
          <tbody>
            {props.ledger.supplierPayments.map((pay) => (
              <tr key={pay.id}>
                <td className="border border-zinc-300 px-2 py-1">
                  {pay.paidAt} · {pay.paidTo ?? "—"}
                  {pay.costLineItemId
                    ? ` · ${lineById.get(pay.costLineItemId) ?? "linked row"}`
                    : ""}
                </td>
                <td className="border border-zinc-300 px-2 py-1 tabular-nums">
                  {formatMoney(pay.amountCents, pay.currency)}
                </td>
                <td className="border border-zinc-300 px-2 py-1">
                  <button
                    type="button"
                    onClick={() => void props.onDelete(pay.id)}
                    className="text-red-500 hover:underline"
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="text-[11px] text-zinc-500">Money paid to hotels, transport operators, etc.</p>
      )}
    </div>
  );
}

function CurrencySettingsForm(props: {
  settings: CostLedgerProjection["settings"];
  saving?: boolean;
  onSave: (patch: Record<string, unknown>) => Promise<boolean>;
}) {
  const [baseCurrency, setBaseCurrency] = useState(props.settings.baseCurrency);
  const [foreignCurrency, setForeignCurrency] = useState(props.settings.foreignCurrency ?? "");
  const [exchangeRate, setExchangeRate] = useState(
    props.settings.exchangeRate != null ? String(props.settings.exchangeRate) : "",
  );
  const [exchangeRateDate, setExchangeRateDate] = useState(
    props.settings.exchangeRateDate ?? "",
  );
  const [manual, setManual] = useState(props.settings.exchangeRateManual);

  return (
    <div className="flex flex-wrap items-end gap-3 text-[11px]">
      <label>
        Base
        <input
          value={baseCurrency}
          onChange={(e) => setBaseCurrency(e.target.value.toUpperCase())}
          maxLength={3}
          className="ml-1 w-14 rounded border border-zinc-300 px-1 py-0.5 uppercase"
        />
      </label>
      <label>
        Foreign
        <input
          value={foreignCurrency}
          onChange={(e) => setForeignCurrency(e.target.value.toUpperCase())}
          maxLength={3}
          placeholder="JPY"
          className="ml-1 w-14 rounded border border-zinc-300 px-1 py-0.5 uppercase"
        />
      </label>
      <label>
        Rate
        <input
          value={exchangeRate}
          onChange={(e) => setExchangeRate(e.target.value)}
          placeholder="0.011"
          className="ml-1 w-20 rounded border border-zinc-300 px-1 py-0.5"
        />
      </label>
      <label>
        Date
        <input
          type="date"
          value={exchangeRateDate}
          onChange={(e) => setExchangeRateDate(e.target.value)}
          className="ml-1 rounded border border-zinc-300 px-1 py-0.5"
        />
      </label>
      <label className="flex items-center gap-1">
        <input type="checkbox" checked={manual} onChange={(e) => setManual(e.target.checked)} />
        Manual
      </label>
      <button
        type="button"
        disabled={props.saving}
        onClick={() =>
          void props.onSave({
            baseCurrency,
            foreignCurrency: foreignCurrency || null,
            exchangeRate: exchangeRate ? Number.parseFloat(exchangeRate) : null,
            exchangeRateDate: exchangeRateDate || null,
            exchangeRateManual: manual,
          })
        }
        className="rounded border border-violet-600 bg-violet-600 px-2 py-1 text-white disabled:opacity-50"
      >
        Save
      </button>
    </div>
  );
}
