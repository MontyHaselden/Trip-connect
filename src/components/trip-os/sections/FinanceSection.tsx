"use client";

import { useMemo, useState } from "react";

import { emptyCostLedgerProjection } from "@/lib/trip-engine/cost-ledger/empty-projection";
import type { CostLedgerProjection, CostLineItemDraft } from "@/lib/trip-engine/cost-ledger/types";
import { formatMoney, parseMoneyInput } from "@/lib/trip-engine/cost-ledger/format-money";
import type { RosterSummary } from "@/lib/trip-engine/types";

import { CostLineDrawer, type CostLineFormValues } from "../costs/CostLineDrawer";
import { FinanceSpreadsheet } from "../finance/FinanceSpreadsheet";

type FinanceAction =
  | { action: "updateSettings"; settings: Record<string, unknown> }
  | { action: "addLine"; line: Record<string, unknown> }
  | { action: "updateLine"; lineId: string; line: Record<string, unknown> }
  | { action: "deleteLine"; lineId: string }
  | { action: "deleteEmptyLines" }
  | { action: "addFund"; fund: Record<string, unknown> }
  | { action: "deleteFund"; fundId: string }
  | { action: "addPayment"; payment: Record<string, unknown> }
  | { action: "deletePayment"; paymentId: string };

function linePayload(values: CostLineFormValues): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    category: values.category,
    description: values.description,
    notes: values.notes || null,
    totalAmountCents: values.totalAmountCents,
    currency: values.currency,
    quantity: values.quantity,
    allocationRuleType: values.allocationRuleType,
    allocationRulePayload: {},
  };
  if (values.allocationRuleType === "equal_group" && values.groupId) {
    payload.allocationRulePayload = { groupId: values.groupId };
  }
  if (values.allocationRuleType === "assign_one" && values.participantId) {
    payload.allocationRulePayload = { participantId: values.participantId };
  }
  return payload;
}

export function FinanceSection(props: {
  roster: RosterSummary;
  costLedger: CostLedgerProjection | null;
  onFinanceAction: (payload: FinanceAction) => Promise<boolean>;
  saving?: boolean;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingLine, setEditingLine] = useState<CostLineItemDraft | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showEmptyLines, setShowEmptyLines] = useState(true);
  const [bottomTab, setBottomTab] = useState<"funds" | "payments">("funds");
  const [fundName, setFundName] = useState("");
  const [fundAmount, setFundAmount] = useState("");
  const [paymentParticipantId, setPaymentParticipantId] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentLabel, setPaymentLabel] = useState("deposit");

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

  function openAddDrawer() {
    setEditingLine(null);
    setDrawerOpen(true);
  }

  function openEditDrawer(line: CostLineItemDraft) {
    setEditingLine(line);
    setDrawerOpen(true);
  }

  async function saveLine(values: CostLineFormValues) {
    const payload = linePayload(values);
    if (values.lineId) {
      await props.onFinanceAction({ action: "updateLine", lineId: values.lineId, line: payload });
    } else {
      await props.onFinanceAction({ action: "addLine", line: payload });
    }
  }

  async function deleteLine(lineId: string) {
    if (!confirm("Delete this row?")) return;
    await props.onFinanceAction({ action: "deleteLine", lineId });
    setDrawerOpen(false);
    setEditingLine(null);
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
            <ToolbarButton onClick={openAddDrawer} disabled={!hasRoster} primary>
              + Row
            </ToolbarButton>
            <ToolbarButton onClick={() => setShowSettings((v) => !v)}>Currency</ToolbarButton>
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
            showEmptyLines={showEmptyLines}
            onEditLine={openEditDrawer}
          />
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-zinc-500">
            Add participants in Users — they become columns in this sheet.
          </div>
        )}
      </div>

      <footer className="shrink-0 border-t border-zinc-300 bg-zinc-50">
        <div className="flex border-b border-zinc-200">
          {(["funds", "payments"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setBottomTab(tab)}
              className={[
                "px-4 py-2 text-[11px] font-medium capitalize",
                bottomTab === tab
                  ? "border-b-2 border-violet-600 bg-white text-zinc-900"
                  : "text-zinc-500 hover:text-zinc-800",
              ].join(" ")}
            >
              {tab}
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
          ) : (
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
          )}
        </div>
      </footer>

      <CostLineDrawer
        open={drawerOpen}
        roster={props.roster}
        baseCurrency={settings.baseCurrency}
        editingLine={editingLine}
        onClose={() => {
          setDrawerOpen(false);
          setEditingLine(null);
        }}
        onSave={saveLine}
        onDelete={deleteLine}
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
